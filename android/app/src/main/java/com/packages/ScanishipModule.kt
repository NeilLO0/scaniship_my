package com.scaniship.packages

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.widget.Toast
import cn.pda.serialport.Tools
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.handheld.uhfr.UHFRManager
import com.scaniship.entity.TagInfo
import com.uhf.api.cls.Reader
import java.util.Timer
import java.util.TimerTask
import android.content.IntentFilter
import android.view.KeyEvent


class ScanishipModule(reactApplicationContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactApplicationContext) {
    var mUhfrManager: UHFRManager = UHFRManager.getInstance()
    var mSharedPreferences = reactApplicationContext.getSharedPreferences("UHF", android.content.Context.MODE_PRIVATE)
    private var index: Long = 1
    private val tagInfoList: MutableList<TagInfo> = ArrayList<TagInfo>()
    private val listEPC: MutableList<String> = ArrayList<String>()
    private val scannedTagInfoList: MutableList<TagInfo> = ArrayList<TagInfo>()
    private val isContinuesRead: Boolean = true
    private val tagInfoMap: MutableMap<String, TagInfo> = LinkedHashMap<String, TagInfo>()
    private var timer: Timer? = null
    private var isReader: Boolean = false
    private var isConnectUHF: Boolean = false
    private var keyReceiver: KeyReceiver = KeyReceiver(getReactApplicationContext())
    var time: Int = 0
    var speed: Long = 0
    var MSG_INVENROTY = 1
    var MSG_INVENROTY_TIME = 1001

    var handler = object : Handler(Looper.getMainLooper()) {
        override fun handleMessage(msg: Message) {
            super.handleMessage(msg)

            when(msg.what) {
                MSG_INVENROTY -> {
                    // scannedTagInfoList.addAll(tagInfoList)
                    var array: WritableArray = Arguments.createArray()
                    for (epc in listEPC) {
                        array.pushString(epc)
                    }

                    getReactApplicationContext()
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("tagInfoList", array)
                }

                MSG_INVENROTY_TIME -> {
                    time += 1
//                    Toast.makeText(currentActivity?.baseContext, time.toString(), Toast.LENGTH_SHORT).show()
                }

            }
        }
    }

    private class KeyReceiver(private val applicationContext: ReactApplicationContext) :
        BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            var keyCode: Int = intent.getIntExtra("keyCode", 0)
            if (keyCode == 0) {
                keyCode = intent.getIntExtra("keycode", 0)
            }
            val keyDown: Boolean = intent.getBooleanExtra("keydown", false)

            // 若帶有條碼資料，也一併觸發按鍵事件，確保掃描鍵有動作
            val dataCandidate = intent.getStringExtra("scan_data")
                ?: intent.getStringExtra("barcode_string")
                ?: intent.getStringExtra("SCAN_RESULT")
                ?: intent.getStringExtra("data")
                ?: intent.getStringExtra("barcode")

            android.util.Log.d(
                "ScanishipModule",
                "KeyReceiver action=${intent.action} keyCode=$keyCode keyDown=$keyDown data=$dataCandidate"
            )

            val shouldEmit =
                (!keyDown && keyCode != 0) ||
                (keyDown && keyCode != 0) ||
                dataCandidate != null

            if (shouldEmit) {
                applicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("buttonClick", keyCode);
            }
        }
    }

    private val inventoryThread = object : Runnable {
        override fun run() {
            var readerTagInfoList : List<Reader.TAGINFO>? = null;
            if (isContinuesRead) {
                readerTagInfoList = mUhfrManager.tagEpcTidInventoryByTimer(50)

            } else {
                readerTagInfoList = mUhfrManager.tagInventoryByTimer(50)
            }

            if (readerTagInfoList == null) {
                if (isContinuesRead) {
                    mUhfrManager.asyncStopReading()
                    mUhfrManager.asyncStartReading()
                }
            }

            if (!readerTagInfoList.isNullOrEmpty()) {
                for (taginfo in readerTagInfoList) {
                    val infoMap: Map<String, TagInfo> = pooled6cData(taginfo)

                    tagInfoList.clear()
                    tagInfoList.addAll(infoMap.values)
                    listEPC.clear()
                    listEPC.addAll(infoMap.keys)
                }

                handler.sendEmptyMessage(MSG_INVENROTY);
            } else {
                speed = 0
            }

            if (isContinuesRead && isReader) {
                handler.postDelayed(this, 0)
            } else {
                if (timer != null) {
                    timer?.cancel()
                    timer = null
                }
                handler.sendEmptyMessage(MSG_INVENROTY_TIME)
                isReader = false
            }
        }
    }

    @ReactMethod
    fun registerKeyCodeReceiver() {
        val filter: IntentFilter = IntentFilter()
        filter.addAction("android.rfid.FUN_KEY")
        filter.addAction("android.intent.action.FUN_KEY")
        // 廠商常見掃描鍵/條碼廣播
        filter.addAction("com.rscja.scanner.action.BARCODE_DATA")
        filter.addAction("android.intent.action.SCANRESULT")
        filter.addAction("com.android.server.scannerservice.broadcast")
        filter.addAction("com.symantec.mobilesecurity.SCAN")
        filter.addAction("com.honeywell.decode.intent.action.BARCODE_DATA")
        reactApplicationContext.applicationContext.registerReceiver(this.keyReceiver, filter)
    }
    override fun getName(): String {
        return "ScanishipModule"
    }

    @ReactMethod
    fun unregisterKeyReceiver() {
        reactApplicationContext.applicationContext.unregisterReceiver(this.keyReceiver);
    }

    @ReactMethod
    fun initModule() {
        //5106和6106 /6107和6108 支持33db
        this.mUhfrManager.setRegion(Reader.Region_Conf.RG_PRC)
        val err = this.mUhfrManager.setPower(
            33,
            33
        ) //set uhf module power

        if (err == Reader.READER_ERR.MT_OK_ERR) {
            this.isConnectUHF = true
            val err1 = this.mUhfrManager.setRegion(Reader.Region_Conf.valueOf(1))
            setParam()
        } else {
            var err1 = this.mUhfrManager.setPower(30, 30);
            if (err1 == Reader.READER_ERR.MT_OK_ERR) {
                Toast.makeText(
                    reactApplicationContext,
                    "FreRegion:" + Reader.Region_Conf.valueOf(mSharedPreferences!!.getInt("freRegion", 1)) +
                            "\n" + "Read Power:" + 30 +
                            "\n" + "Write Power:" + 30, Toast.LENGTH_LONG
                ).show()
                setParam()
            } else {
                Toast.makeText(reactApplicationContext, "Module init fail", Toast.LENGTH_SHORT).show()
            }
        }
        this.registerKeyCodeReceiver();
        return
    }

    private fun setParam() {
        this.mUhfrManager.setGen2session(0)
        this.mUhfrManager.setTarget(0)
        this.mUhfrManager.setQvaule(0)
        this.mUhfrManager.setFastID(false)

        var b :Boolean? = this.mSharedPreferences?.getBoolean("show_rr_advance_settings", false);
        if ( b != null && b) {
            val jgTime = mSharedPreferences!!.getInt("jg_time", 6)
            val dwell = mSharedPreferences!!.getInt("dwell", 2)
            val i = mUhfrManager.setRrJgDwell(jgTime, dwell)
        }
    }

    @ReactMethod
    fun inventoryEPC(power: Int) {
        isReader = true
        speed = 0
        this.mUhfrManager.setPower(power, power)
        Toast.makeText(reactApplicationContext, "Start!!", Toast.LENGTH_SHORT).show()

        if (this.mUhfrManager.gen2session != 3) {
            this.mUhfrManager.setGen2session(false)
        }

        if (this.timer == null) {
            this.timer = Timer()
            this.timer!!.schedule(
                object : TimerTask() {
                    override fun run() {
                        handler.sendEmptyMessage(MSG_INVENROTY_TIME)
                    }
                }
                , 1000, 1000)
        }

        this.handler.postDelayed(this.inventoryThread, 0)
    }

    @ReactMethod
    fun stopInventory() {
        if (this.isConnectUHF) {
            if (this.isReader) {
                if (this.isContinuesRead) {
                    this.mUhfrManager.asyncStopReading()
                }
                this.handler.removeCallbacks(this.inventoryThread)
                this.isReader = false

                if (this.timer != null) {
                    this.timer!!.cancel()
                    this.timer = null
                }
            }
        } else {
            Toast.makeText(reactApplicationContext, "Not Connect To UHF", Toast.LENGTH_SHORT).show()
        }

        this.isReader = false
    }

    @ReactMethod
    fun clear() {
        tagInfoMap.clear()
        tagInfoList.clear()
    }

    @ReactMethod
    fun setPower(dbm: Int) {
        // dbm usually 5~33 for this module; clamp to safe range.
        val power = dbm.coerceIn(5, 33)
        mUhfrManager.setPower(power, power)
    }

    // Required for React Native NativeEventEmitter on Android
    @ReactMethod
    fun addListener(eventName: String) {
        // No-op: events are pushed from native to JS via DeviceEventManagerModule.
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // No-op: RN handles listener bookkeeping on the JS side.
    }

    override fun getConstants(): MutableMap<String, Any>? {
        return super.getConstants()
    }
    private fun pooled6cData(info: Reader.TAGINFO) : Map<String, TagInfo> {
        var epcAndTid = Tools.Bytes2HexString(info.EpcId, info.EpcId.size);
        if (tagInfoMap.containsKey(epcAndTid)) {
            var tagInfo: TagInfo = tagInfoMap.getValue(epcAndTid)
            var count: Long = tagInfo.getCount()
            count += 1
            tagInfo.setRssi(info.RSSI.toString())
            tagInfo.setCount(count)
            if (info.EmbededData != null && info.EmbededDatalen > 0) {
                tagInfo.setTid(Tools.Bytes2HexString(info.EmbededData, info.EmbededDatalen.toInt()))
            }

            tagInfoMap[epcAndTid] = tagInfo
        } else {
            var tagInfo: TagInfo = TagInfo()
            tagInfo.setIndex(index)
            tagInfo.setType("6C")
            tagInfo.setEpc(Tools.Bytes2HexString(info.EpcId, info.EpcId.size))
            tagInfo.setCount(1);
            if (info.EmbededData != null && info.EmbededDatalen > 0) {
                tagInfo.setTid(Tools.Bytes2HexString(info.EmbededData, info.EmbededDatalen.toInt()))
            }
            tagInfo.setRssi(info.RSSI.toString() + "")
            tagInfoMap[epcAndTid] = tagInfo
            index++
        }

        return tagInfoMap
    }

    private fun getReadCount() : Long {
        var readCount: Long = 0
        for (i in tagInfoList.indices) {
            readCount += tagInfoList[i].getCount()
        }
        return readCount
    }
}
