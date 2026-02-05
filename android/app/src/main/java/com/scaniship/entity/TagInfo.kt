package com.scaniship.entity

/**
 * Minimal TagInfo model to satisfy the UHF module integration.
 * Fields are mutable to mirror the original Java-style setters/getters used in ScanishipModule.
 */
class TagInfo {
    private var index: Long = 0
    private var type: String = ""
    private var epc: String = ""
    private var count: Long = 0
    private var tid: String = ""
    private var rssi: String = ""

    fun setIndex(value: Long) {
        index = value
    }

    fun getIndex(): Long = index

    fun setType(value: String) {
        type = value
    }

    fun getType(): String = type

    fun setEpc(value: String) {
        epc = value
    }

    fun getEpc(): String = epc

    fun setCount(value: Long) {
        count = value
    }

    fun getCount(): Long = count

    fun setTid(value: String) {
        tid = value
    }

    fun getTid(): String = tid

    fun setRssi(value: String) {
        rssi = value
    }

    fun getRssi(): String = rssi
}
