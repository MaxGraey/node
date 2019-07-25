import { BLOCK_MAXSIZE, BLOCK, BLOCK_OVERHEAD } from "rt/common";
import { E_INVALIDLENGTH, E_INDEXOUTOFRANGE } from "util/error";
import { Uint8Array } from "typedarray";

export class Buffer extends Uint8Array {
  constructor(size: i32) {
    super(size);
  }

  public static alloc(size: i32): Buffer {
    return new Buffer(size);
  }

  @unsafe public static allocUnsafe(size: i32): Buffer {
    // Node throws an error if size is less than 0
    if (u32(size) > BLOCK_MAXSIZE) throw new RangeError(E_INVALIDLENGTH);
    let buffer = __alloc(size, idof<ArrayBuffer>());
    // This retains the pointer to the result Buffer.
    let result = changetype<Buffer>(__alloc(offsetof<Buffer>(), idof<Buffer>()));
    result.data = changetype<ArrayBuffer>(buffer);
    result.dataStart = changetype<usize>(buffer);
    result.dataLength = size;
    return result;
  }

  public static isBuffer<T>(value: T): bool {
    return value instanceof Buffer;
  }

  readUInt8(offset: i32 = 0): u8 {
    if(<u32>offset >= this.dataLength) throw new RangeError(E_INDEXOUTOFRANGE);
    return load<u8>(this.dataStart + usize(offset));
  }

  writeUInt8(value: u8, offset: i32 = 0): i32 {
    if(<u32>offset >= this.dataLength) throw new RangeError(E_INDEXOUTOFRANGE);
    store<u8>(this.dataStart + offset, value);
    return offset + 1;
  }

  writeInt8(value: i8, offset: i32 = 0): i32 {
    if(<u32>offset >= this.dataLength) throw new RangeError(E_INDEXOUTOFRANGE);
    store<i8>(this.dataStart + offset, value);
    return offset + 1;
  }

  readInt8(offset: i32 = 0): i8 {
    if(<u32>offset >= this.dataLength) throw new RangeError(E_INDEXOUTOFRANGE);
    return load<i8>(this.dataStart + usize(offset));
  }
}

export namespace Buffer {
  export namespace HEX {
    /** Calculates the two char combination from the byte. */
    @inline export function charsFromByte(byte: u32): u32 {
      let top = (byte >>> 4) & 0xF;
      let bottom = (0xF & byte);
      top += select(0x57, 0x30, top > 9);
      bottom += select(0x57, 0x30, bottom > 9);
      return (bottom << 16) | top;
    }

    /** Calculates the byte length of the specified string when encoded as HEX. */
    export function byteLength(str: string): i32 {
      let ptr = changetype<usize>(str);
      let byteCount = changetype<BLOCK>(changetype<usize>(str) - BLOCK_OVERHEAD).rtSize;
      let length = byteCount >> 2;
      // The string length must be even because the bytes come in pairs of characters two wide
      if (byteCount & 0x3) return 0; // encoding fails and returns an empty ArrayBuffer

      byteCount += ptr;
      while (ptr < byteCount) {
        var char = load<u16>(ptr);
        if ((char >= 0x30 && char <= 0x39) || (char >= 0x61 && char <= 0x66) || (char >= 0x41 && char <= 0x46)) {
          ptr += 2;
          continue;
        } else {
          return 0;
        }
      }
      return length;
    }

    /** Creates an ArrayBuffer from a given string that is encoded in the HEX format. */
    export function encode(str: string): ArrayBuffer {
      let bufferLength = byteLength(str);
      // short path: string is not a valid hex string, return a new empty ArrayBuffer
      if (bufferLength == 0) return changetype<ArrayBuffer>(__retain(__alloc(0, idof<ArrayBuffer>())));

      // long path: loop over each enociding pair and perform the conversion
      let ptr = changetype<usize>(str);
      let byteEnd = changetype<BLOCK>(changetype<usize>(str) - BLOCK_OVERHEAD).rtSize + ptr;
      let result = __alloc(bufferLength, idof<ArrayBuffer>());
      let b: u32 = 0;
      let outChar = 0;
      for (let i: usize = 0; ptr < byteEnd; i++) {
        let odd = i & 1;
        b = odd ? (b >>> 16) : load<u32>(ptr);
        outChar <<= 4;
        switch (b & 0xFF) {
          case 0x30: outChar |= 0x0; break;
          case 0x31: outChar |= 0x1; break;
          case 0x32: outChar |= 0x2; break;
          case 0x33: outChar |= 0x3; break;
          case 0x34: outChar |= 0x4; break;
          case 0x35: outChar |= 0x5; break;
          case 0x36: outChar |= 0x6; break;
          case 0x37: outChar |= 0x7; break;
          case 0x38: outChar |= 0x8; break;
          case 0x39: outChar |= 0x9; break;
          case 0x61: outChar |= 0xa; break;
          case 0x62: outChar |= 0xb; break;
          case 0x63: outChar |= 0xc; break;
          case 0x64: outChar |= 0xd; break;
          case 0x65: outChar |= 0xe; break;
          case 0x66: outChar |= 0xf; break;
          case 0x41: outChar |= 0xa; break;
          case 0x42: outChar |= 0xb; break;
          case 0x43: outChar |= 0xc; break;
          case 0x44: outChar |= 0xd; break;
          case 0x45: outChar |= 0xe; break;
          case 0x46: outChar |= 0xf; break;
        }
        if (odd) {
          store<u8>(result + (i >> 1), <u8>(outChar & 0xFF));
          ptr += 4;
        }
      }
      return changetype<ArrayBuffer>(result);
    }

    /** Creates an String from a given ArrayBuffer that is decoded in the HEX format. */
    export function decode(buff: ArrayBuffer): string {
      return decodeUnsafe(changetype<usize>(buff), buff.byteLength);
    }

    /** Decodes a block of memory from the given pointer with the given length to a utf16le encoded string in HEX format. */
    @unsafe export function decodeUnsafe(ptr: usize, length: i32): string {
      let stringByteLength = length << 2; // length * (2 bytes per char) * (2 chars per input byte)
      let result = __alloc(stringByteLength, idof<String>());
      let i = <usize>0;
      let inputByteLength = <usize>length + ptr;

      // loop over each byte and store a `u32` for each one
      while (ptr < inputByteLength) {
        store<u32>(result + i, charsFromByte(<u32>load<u8>(ptr)));
        i += 4;
        ptr++;
      }

      return changetype<string>(result);
    }
  }
}
