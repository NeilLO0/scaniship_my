import { NativeEventEmitter, NativeModules } from 'react-native';

type ScanishipModuleType = {
  initModule: () => void;
  inventoryEPC: (power: number) => void;
  stopInventory: () => void;
  setPower: (dbm: number) => void;
  registerKeyCodeReceiver: () => void;
  unregisterKeyReceiver: () => void;
  clear: () => void;
};

const NativeUhf: ScanishipModuleType | undefined = (NativeModules as any).ScanishipModule;
const emitter = NativeUhf ? new NativeEventEmitter(NativeUhf as any) : null;

type TagListener = (tags: string[]) => void;
type ButtonListener = (value: number) => void;

export const uhf = {
  isAvailable: !!NativeUhf && !!emitter,
  init: () => {
    if (!NativeUhf) return;
    NativeUhf.initModule();
    NativeUhf.registerKeyCodeReceiver();
  },
  start: (power: number) => {
    if (!NativeUhf) return;
    NativeUhf.inventoryEPC(power);
  },
  setPower: (dbm: number) => {
    if (!NativeUhf) return;
    NativeUhf.setPower(dbm);
  },
  stop: () => {
    if (!NativeUhf) return;
    NativeUhf.stopInventory();
  },
  clear: () => {
    if (!NativeUhf) return;
    NativeUhf.clear();
  },
  dispose: () => {
    if (!NativeUhf) return;
    NativeUhf.unregisterKeyReceiver();
    NativeUhf.stopInventory();
  },
  onTags: (listener: TagListener) => {
    if (!emitter) return { remove: () => {} };
    return emitter.addListener('tagInfoList', listener);
  },
  onButton: (listener: ButtonListener) => {
    if (!emitter) return { remove: () => {} };
    return emitter.addListener('buttonClick', listener);
  },
};
