var isUndefined = require("kaphein-js").isUndefined;
var isUndefinedOrNull = require("kaphein-js").isUndefinedOrNull;
var isString = require("kaphein-js").isString;
var isFunction = require("kaphein-js").isFunction;
var isCallable = require("kaphein-js").isCallable;

module.exports = (function ()
{
    function _selectNonUndefined(preferred, alternative)
    {
        return (
            !isUndefined(preferred)
            ? preferred
            : alternative
        );
    }

    /**
     *  @param {number} lhs
     *  @param {number} rhs
     */
    function integerComparator(lhs, rhs)
    {
        return lhs - rhs;
    }

    /**
     *  @param {string} l
     *  @param {string} r
     */
    function stringComparator(l, r)
    {
        if(!isString(l) || !isString(r)) {
            throw new TypeError("Both 'l' and 'r' must be strings.");
        }

        var minLen = (l.length < r.length ? l.length : r.length);
        var i = 0;
        for(; i < minLen; ++i) {
            var diff = l.charCodeAt(i) - r.charCodeAt(i);
            if(diff !== 0) {
                return diff;
            }
        }

        if(l.length > minLen) {
            return l.charCodeAt(i);
        }
        else if(r.length > minLen) {
            return r.charCodeAt(i);
        }

        return 0;
    }

    /**
     *  @param {Object} arr
     *  @param {Function} traitAssertionFunc
     *  @param {*} pushBackMethodKey
     *  @param {ArrayLike<any>} arrayLike
     *  @param {Function} [mapFunction]
     *  @param {*} [thisArg]
     *  @returns {Object}
     */
    function _arrayFromFunctionBody(arr, traitAssertionFunc, pushBackMethodKey, arrayLike) {
        traitAssertionFunc = (
            isUndefinedOrNull(traitAssertionFunc)
            ? (function (v) {return v;})
            : traitAssertionFunc
        );
        var mapFn = arguments[4];
        var mapFnExist = isFunction(mapFn);
        var thisArg = arguments[5];

        if(arrayLike[global.Symbol.iterator]) {
            for(
                var i = arrayLike[global.Symbol.iterator](), iP = i.next(), j = 0;
                !iP.done;
                iP = i.next(), ++j
            ) {
                var elem = traitAssertionFunc(iP.value);
                if(mapFnExist) {
                    arr[pushBackMethodKey](mapFn.call(thisArg, elem, j));
                }
                else {
                    arr[pushBackMethodKey](elem);
                }
            }
        }
        //TODO : 코드 작성...?
//        else if (isArrayLike(arrayLike)) {
//            
//        }

        return arr;
    }

    function isUint8(o)
    {
        return Number.isSafeInteger(o)
            && (o >= 0 && o < 256)
        ;
    }

    function _throwRangeErrorOfByteCount()
    {
        throw new RangeError("'byteCount' can be only 1, 2 or 4.");
    }

    function isNonNegativeSafeInteger(v)
    {
        return Number.isSafeInteger(v) && v >= 0;
    }

    /**
     *  @param {number[]} src
     *  @returns {number[]}
     */
    function _copyIntArray(src)
    {
        var i = src.length;
        var cloneOfSrc = new Array(i);
        while(i > 0) {
            --i;
            cloneOfSrc[i] = src[i];
        }

        return cloneOfSrc;
    }

    /**
     *  @param {number[][]} src
     *  @returns {number[][]}
     */
    function _copyTwoDimIntArray(src)
    {
        var i = src.length;
        var cloneOfSrc = new Array(i);
        while(i > 0) {
            --i;

            var srcElem = src[i];
            var j = srcElem.length;
            var clonedElem = new Array(j);
            while(j > 0) {
                --j;
                clonedElem[j] = srcElem[j];
            }
            cloneOfSrc[i] = clonedElem;
        }

        return cloneOfSrc;
    }

    /**
     *  @param {number} v
     *  @returns {number}
     */
    function _assertIsNonNegativeSafeInteger(v)
    {
        if(!isNonNegativeSafeInteger(v)) {
            throw new TypeError("The value must be a non-negative safe integer.");
        }

        return v;
    }

    var assertion = {
        /**
         *  @param {boolean} boolExpr
         *  @param {string} [message]
         *  @param {Function} [errorClass]
         */
        isTrue : function (boolExpr)
        {
            if(!boolExpr) {
                var errorClass = (
                    isFunction(arguments[2])
                    ? arguments[2] :
                    Error
                );

                throw new errorClass((
                    isUndefinedOrNull(arguments[1])
                    ? "Assertion Failed" :
                    arguments[1].toString()
                ));
            }
        },

        /**
         *  @param {boolean} boolExpr
         *  @param {string} [message]
         *  @param {Function} [errorClass]
         */
        isFalse : function (boolExpr)
        {
            return assertion.isTrue(
                !boolExpr,
                arguments[1],
                arguments[2]
            );
        },

        /**
         *  @param {Object} o
         *  @param {string} [message]
         *  @returns {Object}
         */
        isNotUndefined : function (o)
        {
            if(isUndefined(o)) {
                throw new TypeError(arguments[1]);
            }

            return o;
        },

        /**
         *  @param {Object} o
         *  @param {Function} klass
         *  @param {string} [message]
         *  @returns {Object}
         */
        isInstanceOf : function (o, klass)
        {
            if(!(o instanceof klass)) {
                throw new TypeError(arguments[2]);
            }

            return o;
        },

        /**
         *  @param {number} n
         *  @param {string} [message]
         *  @returns {number}
         */
        isNonNegativeSafeInteger : function (n)
        {
            var message = arguments[1];

            if(Number.isSafeInteger(n)) {
                throw new TypeError(message);
            }
            else if(n < 0) {
                throw new RangeError(message);
            }

            return n;
        }
    };

    function _areEqual(lhs, rhs)
    {
        if(lhs === rhs) {
            return true;
        }

        if(
            Array.isArray(lhs)
            && Array.isArray(rhs)
        ) {
            if(lhs.length !== rhs.length) {
                return false;
            }

            var count = lhs.length;
            for(var i = count; i > 0; ) {
                --i;

                if(!_areEqual(lhs[i], rhs[i])) {
                    return false;
                }
            }

            return true;
        }

        if(
            !isUndefinedOrNull(lhs)
            && "equals" in lhs && isCallable(lhs.equals)
        ) {
            return lhs.equals(rhs);
        }

        if(
            !isUndefinedOrNull(rhs)
            && "equals" in rhs && isCallable(rhs.equals)
        ) {
            return rhs.equals(lhs);
        }

        return false;
    }

    /*////////////////////////////////////////////////////////////////*/

    return {
        integerComparator : integerComparator,
        stringComparator : stringComparator,
        isNonNegativeSafeInteger : isNonNegativeSafeInteger,
        isUint8 : isUint8,
        assertion : assertion,
        _areEqual : _areEqual,
        _selectNonUndefined : _selectNonUndefined,
        _throwRangeErrorOfByteCount : _throwRangeErrorOfByteCount,
        _copyIntArray : _copyIntArray,
        _copyTwoDimIntArray : _copyTwoDimIntArray,
        _assertIsNonNegativeSafeInteger : _assertIsNonNegativeSafeInteger,
        _arrayFromFunctionBody : _arrayFromFunctionBody
    };
})();
