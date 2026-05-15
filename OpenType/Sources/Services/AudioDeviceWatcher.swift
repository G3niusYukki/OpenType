import Foundation
import CoreAudio

public class AudioDeviceWatcher {
    public var onDeviceChanged: ((_ oldDevice: AudioDeviceID?, _ newDevice: AudioDeviceID?) -> Void)?
    public var onDeviceDisconnected: (() -> Void)?

    private(set) public var isWatching = false
    private var listenerBlock: ((AudioObjectID, UnsafePointer<AudioObjectPropertyAddress>) -> Void)?

    public init() {}

    public func startWatching() {
        guard !isWatching else { return }
        isWatching = true

        var address = AudioObjectPropertyAddress(
            mSelector: kAudioHardwarePropertyDefaultInputDevice,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain
        )

        // Store the block so we can remove the SAME block reference later
        let block: (AudioObjectID, UnsafePointer<AudioObjectPropertyAddress>) -> Void = { [weak self] _, _ in
            guard let self = self else { return }
            let newDevice = Self.defaultInputDeviceID()
            DispatchQueue.main.async {
                self.onDeviceChanged?(nil, newDevice)
            }
        }
        listenerBlock = block

        AudioObjectAddPropertyListenerBlock(
            AudioObjectID(kAudioObjectSystemObject),
            &address,
            DispatchQueue.global(qos: .utility),
            block
        )
    }

    public func stopWatching() {
        guard isWatching, let block = listenerBlock else { return }
        isWatching = false
        listenerBlock = nil

        var address = AudioObjectPropertyAddress(
            mSelector: kAudioHardwarePropertyDefaultInputDevice,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain
        )

        AudioObjectRemovePropertyListenerBlock(
            AudioObjectID(kAudioObjectSystemObject),
            &address,
            DispatchQueue.global(qos: .utility),
            block
        )
    }

    public static func defaultInputDeviceID() -> AudioDeviceID? {
        var deviceID: AudioDeviceID = kAudioObjectUnknown
        var size = UInt32(MemoryLayout<AudioDeviceID>.size)
        var address = AudioObjectPropertyAddress(
            mSelector: kAudioHardwarePropertyDefaultInputDevice,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain
        )
        let status = AudioObjectGetPropertyData(
            AudioObjectID(kAudioObjectSystemObject),
            &address,
            0, nil,
            &size, &deviceID
        )
        return status == noErr ? deviceID : nil
    }

    public static func availableInputDevices() -> [AudioDeviceID] {
        var address = AudioObjectPropertyAddress(
            mSelector: kAudioHardwarePropertyDevices,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain
        )

        var size: UInt32 = 0
        AudioObjectGetPropertyDataSize(
            AudioObjectID(kAudioObjectSystemObject),
            &address, 0, nil, &size
        )

        let count = Int(size) / MemoryLayout<AudioDeviceID>.size
        guard count > 0 else { return [] }

        var devices = [AudioDeviceID](repeating: kAudioObjectUnknown, count: count)
        AudioObjectGetPropertyData(
            AudioObjectID(kAudioObjectSystemObject),
            &address, 0, nil, &size, &devices
        )

        // Filter to devices that have input channels
        return devices.filter { deviceID in
            var inputAddress = AudioObjectPropertyAddress(
                mSelector: kAudioDevicePropertyStreamConfiguration,
                mScope: kAudioDevicePropertyScopeInput,
                mElement: kAudioObjectPropertyElementMain
            )
            var propSize: UInt32 = 0
            AudioObjectGetPropertyDataSize(deviceID, &inputAddress, 0, nil, &propSize)
            let bufferListPointer = UnsafeMutablePointer<AudioBufferList>.allocate(capacity: 1)
            defer { bufferListPointer.deallocate() }
            AudioObjectGetPropertyData(deviceID, &inputAddress, 0, nil, &propSize, bufferListPointer)
            let bufferList = UnsafeMutableAudioBufferListPointer(bufferListPointer)
            return bufferList.reduce(0) { $0 + $1.mNumberChannels } > 0
        }
    }
}
