var isUndefined = require("kaphein-js").isUndefined;
var isUndefinedOrNull= require("kaphein-js").isUndefinedOrNull;
var isIterable = require("kaphein-js").isIterable;

var isUint8 = require("./utils").isUint8;
var isNonNegativeSafeInteger = require("./utils").isNonNegativeSafeInteger;
var _assertIsNonNegativeSafeInteger = require("./utils")._assertIsNonNegativeSafeInteger;
var _arrayFromFunctionBody = require("./utils")._arrayFromFunctionBody;

module.exports = (function ()
{
    /**
     *  @readonly
     */
    var _twoPower7 = 128;

    /**
     *  @readonly
     */
    var _twoPower15 = 32768;

    /**
     *  @readonly
     */
    var _twoPower16 = 65536;

    /**
     *  @readonly
     */
    var _twoPower31 = 2147483648;

    /**
     *  @readonly
     */
    var _twoPower32 = 4294967296;

    var _bitsPerByteExp = 3;

    var _bitsPerByte = 1 << _bitsPerByteExp;

    var _byteBm = (1 << _bitsPerByte) - 1;

    var _bufNdxExp = 2;

    var _subNdxBm = (1 << _bufNdxExp) - 1;

    var _bytesPerInt = 1 << _bufNdxExp;

    /**
     *  @constructor
     *  @param {number} [elementCount=0]
     *  @param {number} [initialValue=0]
     */
    function ByteArray()
    {
        var elementCount = (
            isUndefined(arguments[0])
            ? 0
            : _assertIsNonNegativeSafeInteger(arguments[0])
        );

        if(elementCount < 1) {
            this._buffer = [0];
            this._subIndex = 0;

            if(!isUndefined(arguments[1])) {
                this.fill(arguments[1]);
            }
        }
        else {
            this._buffer = new Array(((elementCount - 1) >>> _bufNdxExp) + 1);
            this._subIndex = ((elementCount - 1) & _subNdxBm) + 1;
            this.fill((isUndefined(arguments[1]) ? 0 : arguments[1]));
        }
    }

    /**
     *  @param {ArrayLike<number>} numberArrayLike
     *  @param {Function} [mapFunction]
     *  @param {*} [thisArg]
     *  @returns {ByteArray}
     */
    ByteArray.from = function from(numberArrayLike) {
        return _arrayFromFunctionBody(
            new ByteArray(), _assertIsUint8,
            "pushBack", numberArrayLike,
            arguments[1], arguments[2]
        );
    };

    // /**
    //  *  @function
    //  *  @returns {ByteArray}
    //  */
    // ByteArray.prototype[karbonator.shallowClone] = function () {
    //     return ByteArray.from(this);
    // };

    // /**
    //  *  @function
    //  *  @returns {ByteArray}
    //  */
    // ByteArray.prototype[karbonator.deepClone] = function () {
    //     return ByteArray.from(this);
    // };

    /**
     *  @returns {boolean}
     */
    ByteArray.prototype.isEmpty = function isEmpty() {
        return this._buffer.length < 2 && this._subIndex < 1;
    };

    /**
     *  @returns {number}
     */
    ByteArray.prototype.getElementCount = function getElementCount() {
        return ((this._buffer.length - 1) << _bufNdxExp) + this._subIndex;
    };

    /**
     *  @returns {Iterator<number>}
     */
    ByteArray.prototype[Symbol.iterator] = function () {
        return ({
            next : function () {
                var out = {
                    done : this._index >= this._target.getElementCount()
                };

                if(!out.done) {
                    out.value = this._target.get(this._index);
                    ++this._index;
                }

                return out;
            },
            _target : this,
            _index : 0
        });
    };

    /**
     *  @param {number} index
     *  @returns {number}
     */
    ByteArray.prototype.get = function get(index) {
        this._assertIsValidIndex(index);

        var bufNdx = index >>> _bufNdxExp;
        var subNdx = index & _subNdxBm;

        return _get(this._buffer, bufNdx, subNdx);
    };

    /**
     *  @param {number} index
     *  @param {number} v
     *  @returns {ByteArray}
     */
    ByteArray.prototype.set = function set(index, v) {
        this._assertIsValidIndex(index);
        _assertIsUint8(v); 

        var bufNdx = index >>> _bufNdxExp;
        var subNdx = index & _subNdxBm;

        _set(this._buffer, bufNdx, subNdx, v);

        return this;
    };

    /**
     *  @param {number} v
     *  @param {number} [start]
     *  @param {number} [end]
     *  @returns {ByteArray}
     */
    ByteArray.prototype.fill = function fill(v)
    {
        _assertIsUint8(v);
        var start = (isUndefined(arguments[1]) ? 0 : this._assertIsValidIndex(arguments[1]));
        var elemCount = this.getElementCount();
        var end = (isUndefined(arguments[2]) ? elemCount : this._assertIsValidIndex(arguments[2], elemCount + 1));

        for(var i = start; i < end; ++i) {
            this.set(i, v);
        }

        return this;
    };

    /**
     *  @param {number} lhsIndex
     *  @param {number} rhsIndex
     *  @returns {ByteArray}
     */
    ByteArray.prototype.swapElements = function swapElements(lhsIndex, rhsIndex)
    {
        this._assertIsValidIndex(lhsIndex);
        this._assertIsValidIndex(rhsIndex);

        var lhsElem = this.get(lhsIndex);
        this.set(lhsIndex, this.get(rhsIndex));
        this.set(rhsIndex, lhsElem);

        return this;
    };

    /**
     *  @returns {ByteArray}
     */
    ByteArray.prototype.reverse = function reverse()
    {
        var count = this.getElementCount();
        var halfCount = count >>> 1;
        for(var i = 0, j = count; i < halfCount; ++i) {
            --j;
            this.swapElements(i, j);
        }

        return this;
    };

    /**
     *  @function
     *  @param {number} v
     *  @param {number} [index]
     *  @returns {ByteArray}
     */
    ByteArray.prototype.insert = function insert(v, index)
    {
        _assertIsUint8(v);
        var elemCount = this.getElementCount();
        index = (isUndefined(index) ? elemCount : index);
        this._assertIsValidIndex(index, elemCount + 1);

        if(this._subIndex >= _bytesPerInt) {
            this._buffer.push(0);
            this._subIndex = 0;
        }

        var destBufNdx = index >>> _bufNdxExp;
        var destSubNdx = index & _subNdxBm;

        var i = 0;
        for(i = this._buffer.length - 1; i > destBufNdx; --i) {
            this._buffer[i] >>>= _bitsPerByte;
            _set(
                this._buffer,
                i, 0,
                _get(this._buffer, i - 1, _bytesPerInt - 1)
            );
        }

        if(destSubNdx === 0) {
            this._buffer[destBufNdx] >>>= _bitsPerByte;
        }
        else if(destSubNdx < _bytesPerInt - 1) {
            for(i = _bytesPerInt - 1; i > destSubNdx; --i) {
                _set(
                    this._buffer,
                    destBufNdx, i,
                    _get(this._buffer, destBufNdx, i - 1)
                );
            }
        }

        _set(this._buffer, destBufNdx, destSubNdx, v);
        ++this._subIndex;

        return this;
    };

    /**
     *  @param {number} index
     *  @returns {number}
     */
    ByteArray.prototype.removeAt = function removeAt(index)
    {
        if(this.isEmpty()) {
            throw new Error("No more bytes left.");
        }

        this._assertIsValidIndex(index);

        var destBufNdx = index >>> _bufNdxExp;
        var destSubNdx = index & _subNdxBm;

        var value = _get(this._buffer, destBufNdx, destSubNdx);

        var i = 0, len = 0;
        if(destSubNdx === 0) {
            this._buffer[destBufNdx] <<= _bitsPerByte;
        }
        else if(destSubNdx >= _bytesPerInt - 1) {
            this._buffer[destBufNdx] &= ~_byteBm;
        }
        else {
            for(i = destSubNdx + 1; i < _bytesPerInt; ++i) {
                _set(
                    this._buffer,
                    destBufNdx, i - 1,
                    _get(this._buffer, destBufNdx, i)
                );
            }
        }

        for(i = destBufNdx + 1, len = this._buffer.length; i < len; ++i) {
            _set(this._buffer,
                i - 1, _bytesPerInt - 1,
                _get(this._buffer, i, 0)
            );
            this._buffer[i] <<= _bitsPerByte;
        }

        --this._subIndex;
        if(this._subIndex < 1 && this._buffer.length > 1) {
            this._buffer.pop();
            this._subIndex = _bytesPerInt;
        }

        return value;
    };

    /**
     *  @param {Iterable<any>} iterable
     *  @returns {ByteArray}
     */
    ByteArray.prototype.concatenateAssign = function concatenateAssign(iterable)
    {
        return _arrayFromFunctionBody(
            this, _assertIsUint8,
            "pushBack", iterable
        );
    };

    /**
     *  @param {number} v
     *  @returns {ByteArray}
     */
    ByteArray.prototype.pushFront = function pushFront(v)
    {
        this.insert(v, 0);

        return this;
    };

    /**
     *  @param {number} v
     *  @returns {ByteArray}
     */
    ByteArray.prototype.pushBack = function pushBack(v)
    {
        this.insert(v);

        return this;
    };

    /**
     *  @returns {number}
     */
    ByteArray.prototype.popFront = function popFront()
    {
        return this.removeAt(0);
    };

    /**
     *  @returns {number}
     */
    ByteArray.prototype.popBack = function popBack()
    {
        return this.removeAt(this.getElementCount() - 1);
    };

    /**
     *  @function
     *  @returns {ByteArray}
     */
    ByteArray.prototype.clear = function clear()
    {
        this._buffer.length = 1;
        this._buffer[0] = 0;
        this._subIndex = 0;

        return this;
    };

    /**
     *  @param {number} [startIndex]
     *  @param {number} [endIndex]
     *  @returns {ByteArray}
     */
    ByteArray.prototype.slice = function slice()
    {
        var byteCount = this.getElementCount();
        var startIndex = arguments[0];
        if(isUndefined(startIndex)) {
            startIndex = 0;
        }
        else if(!isNonNegativeSafeInteger(startIndex)) {
            throw new TypeError("");
        }
        else if(startIndex >= byteCount) {
            throw new RangeError("");
        }

        var endIndex = arguments[1];
        if(isUndefined(endIndex)) {
            endIndex = byteCount;
        }
        else if(!isNonNegativeSafeInteger(endIndex)) {
            throw new TypeError("");
        }
        else if(endIndex > byteCount) {
            endIndex = byteCount;
        }

        var slicedByteCount = endIndex - startIndex;
        var newByteArray = new ByteArray(slicedByteCount);
        for(var i = slicedByteCount, j = endIndex; j > startIndex; ) {
            --j;
            --i;

            newByteArray.set(i, this.get(j));
        }

        return newByteArray;
    };

    /**
     *  @param {ByteArray} rhs
     *  @returns {boolean}
     */
    ByteArray.prototype.equals = function equals(rhs)
    {
        if(this === rhs) {
            return true;
        }

        if(isUndefinedOrNull(rhs)) {
            return false;
        }

        var elemCount = this.getElementCount();
        if(elemCount !== rhs.getElementCount()) {
            return false;
        }

        for(var i = 0; i < elemCount; ++i) {
            if(this.get(i) !== rhs.get(i)) {
                return false;
            }
        }

        return true;
    };

    /**
     *  @param {number} [base=10]
     *  @returns {string}
     */
    ByteArray.prototype.toString = function () {
        var base = arguments[0];
        var str = '[';

        var count = this.getElementCount();
        if(count > 0) {
            str += this.get(0).toString(base);
        }

        for(var i = 1; i < count; ++i) {
            str += ", ";
            str += this.get(i).toString(base);
        }

        str += ']';

        return str;
    };

    /**
     *  @private
     *  @param {number} index
     *  @param {number} [maxBound]
     *  @returns {number}
     */
    ByteArray.prototype._assertIsValidIndex = function (index) {
        _assertIsNonNegativeSafeInteger(index);

        var maxBound = arguments[1];
        if(isUndefined(maxBound)) {
            maxBound = this.getElementCount();
        }

        if(index >= maxBound) {
            throw new RangeError("Index out of range.");
        }

        return index;
    };

    /**
     *  @param {number[]} buffer
     *  @param {number} bufferIndex
     *  @param {number} subIndex
     *  @returns {number}
     */
    function _get(buffer, bufferIndex, subIndex)
    {
        var shiftCount = _calculateShiftCount(subIndex);

        return (buffer[bufferIndex] & (_byteBm << shiftCount)) >>> shiftCount;
    }

    /**
     *  @param {number[]} buffer
     *  @param {number} bufferIndex
     *  @param {number} subIndex
     *  @param {number} v
     */
    function _set(buffer, bufferIndex, subIndex, v)
    {
        var shiftCount = _calculateShiftCount(subIndex);

        buffer[bufferIndex] &= ~(_byteBm << shiftCount);
        buffer[bufferIndex] |= (v << shiftCount);
    }

    /**
     *  @param {number} subIndex
     *  @returns {number}
     */
    function _calculateShiftCount(subIndex)
    {
        return ((_bytesPerInt - 1) - subIndex) << _bitsPerByteExp;
    }

    /**
     *  @param {number} v
     *  @returns {number}
     */
    function _assertIsUint8(v)
    {
        if(!isUint8(v)) {
            throw new TypeError("The value must be in range [0, 255].");
        }

        return v;
    }


    /**
     *  @param {number} byteCount
     */
    function _assertByteCountInRange(byteCount)
    {
        if(!isNonNegativeSafeInteger(byteCount)) {
            throw new TypeError("'byteCount' must be a non-negative safe integer.");
        }
        if(!([1, 2, 4].includes(byteCount))) {
            _throwRangeErrorOfByteCount();
        }

        return byteCount;
    }

    /**
     *  @param {number} value
     *  @param {number} byteCount - 1, 2 or 4 only.
     *  @param {boolean} [byteOrderReversed=false]
     *  @param {ByteArray} [dest]
     *  @param {number} [destIndex]
     *  @returns {ByteArray}
     */
    function integerToBytes(value, byteCount) {
        if(!Number.isSafeInteger(value)) {
            throw new TypeError("'value' must be a safe integer.");
        }

        _assertByteCountInRange(byteCount);

        var dest = arguments[3];
        if(isUndefined(dest)) {
            dest = new ByteArray(byteCount);
        }
        else if(!(dest instanceof ByteArray)) {
            throw new TypeError("'dest' must be an instance of 'karboantor.ByteArray'.");
        }

        var destIndex = arguments[4];
        if(isUndefined(destIndex)) {
            destIndex = dest.getElementCount();
        }
        else if(!isNonNegativeSafeInteger(destIndex)) {
            throw new RangeError("'destIndex' must be a non-negative safe integer.");
        }

        var i = 0;
        for(
            i = destIndex + byteCount - dest.getElementCount();
            i > 0;
        ) {
            --i;

            dest.pushBack(0);
        }

        var j = 0;
        if(arguments[2]) {
            for(i = destIndex, j = byteCount; j > 0; ++i) {
                --j;

                dest.set(i, (value & 0xFF));
                value >>>= 8;
            }
        }
        else for(i = destIndex + byteCount, j = byteCount; j > 0; ) {
            --j;
            --i;

            dest.set(i, (value & 0xFF));
            value >>>= 8;
        }

        return dest;
    }

    /**
     *  @param {ByteArray|Iterable<number>} bytes
     *  @param {number} byteCount - 1, 2 or 4 only.
     *  @param {boolean} [signed=false]
     *  @param {boolean} [byteOrderReversed=false]
     *  @param {number} [startIndex=0]
     *  @returns {number}
     */
    function bytesToInteger(bytes, byteCount) {
        if(!(bytes instanceof ByteArray)) {
            if(isIterable(bytes)) {
                bytes = ByteArray.from(bytes);
            }
            else {
                throw new TypeError(
                    "'byteArray' must be an instance of 'ByteArray'"
                    + " or "
                    + "an iterable collection of integers."
                );
            }
        }

        if(!isNonNegativeSafeInteger(byteCount)) {
            throw new TypeError("'byteCount' must be a non-negative integer.");
        }

        var signed = !!arguments[2];
        var byteOrderReversed = !!arguments[3];
        var index = arguments[4];
        if(isUndefined(index)) {
            index = 0;
        }
        else if(!isNonNegativeSafeInteger(index)) {
            throw new TypeError("The parameter 'startIndex' must be a non-negative safe integer.");
        }

        var intValue = 0;

        switch(byteCount) {
        case 0:
            _throwRangeErrorOfByteCount();
        break;
        case 1:
            intValue = bytes.get(index);

            if(signed && intValue >= _twoPower7) {
                intValue -= 256;
            }
        break;
        case 2:
            if(byteOrderReversed) {
                intValue = bytes.get(index);
                intValue |= (bytes.get(++index) << 8);
            }
            else {
                intValue = bytes.get(index);
                intValue <<= 8;
                intValue = bytes.get(++index);
            }

            if(signed && intValue >= _twoPower15) {
                intValue -= _twoPower16;
            }
        break;
        case 3:
            _throwRangeErrorOfByteCount();
        break;
        case 4:
            if(byteOrderReversed) {
                intValue = bytes.get(index);
                intValue |= (bytes.get(++index) << 8);
                intValue |= (bytes.get(++index) << 16);
                intValue |= (bytes.get(++index) << 24);
            }
            else {
                intValue = bytes.get(index);
                intValue <<= 8;
                intValue = bytes.get(++index);
                intValue <<= 8;
                intValue = bytes.get(++index);
                intValue <<= 8;
                intValue = bytes.get(++index);
            }

            if(signed && intValue >= _twoPower31) {
                intValue -= _twoPower32;
            }
        break;
        default:
            _throwRangeErrorOfByteCount();
        }

        return intValue;
    }

    function _throwRangeErrorOfByteCount()
    {
        throw new RangeError("'byteCount' can be only 1, 2 or 4.");
    }

    return {
        ByteArray : ByteArray,
        integerToBytes : integerToBytes,
        bytesToInteger : bytesToInteger
    };
})();
