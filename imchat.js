/**
 * The version.
 * @enum
 */
export const ProtocolVersion = {
    INITIAL: 0,
    0: "INITIAL"
};

export class BinMsg {
    /** @type {string} */
    msg;
    /** @type {string | undefined} */
    author;
    /** @type {string | undefined} */
    platformID;
    /**
     * @public
     * @param {string} msg
     * @param {string} [author]
     * @param {string} [platformID]
     */
    constructor(msg, author, platformID) {
        this.msg = msg;
        this.author = author;
        this.platformID = platformID;
    }
    /**
     * @static
     * @param {ArrayBuffer} buf
     * @returns {BinMsg}
     */
    static readInitial(buf) {
        const bp = BufParser.read(buf);
        return new BinMsg(bp.readString(), this.readOptString(bp));
    }
    /**
     * @static
     * @param {BufParser} bp
     * @returns {string | undefined}
     */
    static readOptString(bp) {
        const present = bp.readBoolean();
        if (!present)
            return undefined;
        return bp.readString();
    }
    /**
     * @static
     * @param {ProtocolVersion} version
     * @param {ArrayBuffer} buf
     * @returns {BinMsg}
     */
    static read(version, buf) {
        switch (version) {
            case ProtocolVersion.INITIAL:
                return BinMsg.readInitial(buf);
            default:
                throw `Unsupported [R] binary format version: ${version} (${ProtocolVersion[version] ?? "doesn't even exist"})`;
        }
    }
    /**
     * @static
     * @param {string} [a]
     * @returns {number}
     */
    static optStringBytes(a) {
        const booleanSize = 1;
        if (a) {
            return booleanSize + BufParser.stringBytes(a); // present
        }
        return booleanSize;
    }
    /**
     * @private
     * @param {BufParser} bp
     * @param {string} [s]
     * @returns {void}
     */
    writeOptString(bp, s) {
        bp.writeBoolean(!!s);
        if (s) {
            bp.writeString(s);
        }
    }
    /**
     * @returns {ArrayBuffer}
     */
    writeInitial() {
        const bp = BufParser.write(BufParser.stringBytes(this.msg) +
            BinMsg.optStringBytes(this.author));
        bp.writeString(this.msg);
        this.writeOptString(bp, this.author);
        return bp.toBuffer();
    }
    /**
     * @param {ProtocolVersion} version
     * @returns {ArrayBuffer}
     */
    write(version) {
        switch (version) {
            case ProtocolVersion.INITIAL:
                return this.writeInitial();
            default:
                throw `Unsupported [W] binary format version: ${version} (${ProtocolVersion[version] ?? "doesn't even exist"})`;
        }
    }
}

export class BufParser {
    /** @type {ArrayBuffer} */
    buffer;
    /**
       * @param {ArrayBuffer} buffer
       */
    constructor(buffer) {
        this.buffer = buffer;
    }
    /**
       * @static
       * @param {ArrayBuffer} buffer
       * @returns {BufParser}
       */
    static read(buffer) {
        return new BufParser(buffer);
    }
    /**
       * @static
       * @param {number} byteLength
       * @returns {BufParser}
       */
    static write(byteLength) {
        const buffer = new ArrayBuffer(byteLength);
        return new BufParser(buffer);
    }
    /** @default 0 */
    writeIndex = 0;
    /** @default 0 */
    readIndex = 0;
    /**
       * @returns {ArrayBuffer}
       */
    toBuffer() {
        return this.buffer.slice(0, this.writeIndex);
    }
    /**
       * @returns {number}
       */
    readByte() {
        const dataView = new DataView(this.buffer);
        return dataView.getUint8(this.readIndex++);
    }
    /**
       * @returns {boolean}
       */
    readBoolean() {
        return this.readByte() === 1;
    }
    /**
       * @returns {number}
       */
    readVarInt() {
        let i = 0;
        let j = 0;
        while (true) {
            const b0 = this.readByte();
            i |= (b0 & 0x7F) << (j * 7);
            if (j > 5) {
                throw new Error("VarInt too big");
            }
            if ((b0 & 0x80) !== 0x80) {
                break;
            }
            j++;
        }
        return i;
    }
    /**
       * @returns {string}
       */
    readString() {
        const length = this.readVarInt();
        const newReadIndex = this.readIndex + length;
        if (newReadIndex > this.buffer.byteLength) {
            throw new Error(`String length ${length} exceeds remaining data (${this.buffer.byteLength - this.readIndex} bytes left)`);
        }
        const view = new TextDecoder().decode(this.buffer.slice(this.readIndex, newReadIndex));
        this.readIndex = newReadIndex;
        return view;
    }

    /**
       * @param {boolean} value
       * @returns {void}
       */
    writeBoolean(value) {
        this.ensureCapacity(1);
        const dataView = new DataView(this.buffer);
        dataView.setUint8(this.writeIndex++, value ? 1 : 0);
    }

    /**
       * @param {string} str
       * @returns {this}
       */
    writeString(str) {
        const byteLength = BufParser.stringBytes(str);
        this.ensureCapacity(byteLength);
        const utf8Bytes = new TextEncoder().encode(str);
        const length = utf8Bytes.length;

        this.writeVarInt(length);

        new Uint8Array(this.buffer).set(utf8Bytes, this.writeIndex);
        this.writeIndex += length;
        return this;
    }

    /**
       * @param {number} value
       * @returns {this}
       */
    writeVarInt(value) {
        let input = value >>> 0;
        if ((input & 0xFFFFFF80) === 0) {
            this.ensureCapacity(1);
            const dataView = new DataView(this.buffer);
            dataView.setUint8(this.writeIndex++, input);
        }
        else if ((input & 0xFFFFC000) === 0) {
            this.ensureCapacity(2);
            const w = ((input & 0x7F) | 0x80) << 8 | (input >>> 7);
            const dataView = new DataView(this.buffer);
            dataView.setUint16(this.writeIndex, w, true); // Little-endian
            this.writeIndex += 2;
        }
        else {
            this.writeVarIntFull(input);
        }
        return this;
    }

    /**
       * @private
       * @param {number} size
       * @returns {void}
       */
    ensureCapacity(size) {
        if (this.writeIndex + size > this.buffer.byteLength) {
            const newBuffer = new ArrayBuffer(this.buffer.byteLength * 2);
            new Uint8Array(newBuffer).set(new Uint8Array(this.buffer));
            this.buffer = newBuffer;
        }
    }
    /**
       * @private
       * @param {number} value
       * @returns {void}
       */
    writeVarIntFull(value) {
        const view = new DataView(this.buffer);
        if ((value & 0xFFFFFF80) === 0) {
            this.ensureCapacity(1);
            view.setUint8(this.writeIndex++, value);
        }
        else if ((value & 0xFFFFC000) === 0) {
            this.ensureCapacity(2);
            const w = ((value & 0x7F) | 0x80) << 8 |
                (value >>> 7);
            view.setUint16(this.writeIndex, w, true); // Little-endian
            this.writeIndex += 2;
        }
        else if ((value & 0xFFE00000) === 0) {
            this.ensureCapacity(3);
            const w = ((value & 0x7F) | 0x80) << 16 |
                (((value >>> 7) & 0x7F) | 0x80) << 8 |
                (value >>> 14);
            view.setUint8(this.writeIndex++, w & 0xFF);
            view.setUint8(this.writeIndex++, (w >>> 8) & 0xFF);
            view.setUint8(this.writeIndex++, (w >>> 16) & 0xFF);
        }
        else if ((value & 0xF0000000) === 0) {
            this.ensureCapacity(4);
            view.setUint8(this.writeIndex++, (value & 0x7F) | 0x80);
            view.setUint8(this.writeIndex++, ((value >>> 7) & 0x7F) | 0x80);
            view.setUint8(this.writeIndex++, ((value >>> 14) & 0x7F) | 0x80);
            view.setUint8(this.writeIndex++, value >>> 21);
        }
        else {
            this.ensureCapacity(5);
            view.setUint8(this.writeIndex++, (value & 0x7F) | 0x80);
            view.setUint8(this.writeIndex++, ((value >>> 7) & 0x7F) | 0x80);
            view.setUint8(this.writeIndex++, ((value >>> 14) & 0x7F) | 0x80);
            view.setUint8(this.writeIndex++, ((value >>> 21) & 0x7F) | 0x80);
            view.setUint8(this.writeIndex++, value >>> 28);
        }
    }
    /**
       * @static
       * @param {string} value
       * @returns {number}
       */
    static stringBytes(value) {
        return new TextEncoder().encode(value).length;
    }
}