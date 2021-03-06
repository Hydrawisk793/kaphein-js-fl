var kapheinJsTypeTrait = require("kaphein-js-type-trait");
var isString = kapheinJsTypeTrait.isString;
var isFunction = kapheinJsTypeTrait.isFunction;
var isIterable = kapheinJsTypeTrait.isIterable;

module.exports = (function ()
{
    var _hasOwnProperty = Object.prototype.hasOwnProperty;

    /**
     *  @param {*} v
     *  @returns {v is symbol}
     */
    function isSymbol(v)
    {
        return "symbol" === typeof v;
    }

    var _pSymMemberIndex = Symbol("karbonator.util.Enum.prototype.index");
    var _pSymMemberKey = Symbol("karbonator.util.Enum.prototype.key");
    var _pSymStaticKeys = Symbol("karbonator.util.Enum.keys");

    /**
     *  @constructor
     */
    function MyEnum()
    {
        throw new Error(
            "'karbonator.util.Enum' cannot be directly instantiated."
            + " use 'karbonator.util.Enum.create' static method"
            + " to create a subtype of 'karbonator.util.Enum'."
        );
    }

    /**
     *  @type {Symbol}
     */
    MyEnum.getIndex = Symbol("karbonator.util.Enum.getIndex");

    /**
     *  @type {Symbol}
     */
    MyEnum.getKey = Symbol("karbonator.util.Enum.getKey");

    /**
     *  @type {Symbol}
     */
    MyEnum.getValue = Symbol("karbonator.util.Enum.getValue");

    /**
     *  @returns {number}
     */
    MyEnum.prototype[MyEnum.getIndex] = function ()
    {
        return this[_pSymMemberIndex];
    };

    /**
     *  @returns {String|Symbol}
     */
    MyEnum.prototype[MyEnum.getKey] = function ()
    {
        return this[_pSymMemberKey];
    };

    /**
     *  var ColorEnum = karbonator.util.Enum.create(
     *      function (proto) {
     *          proto.getNumber = function () {
     *              return this._num;
     *          };
     *          proto.getAlpha = function () {
     *              return this._alpha;
     *          };
     *      },
     *      function (num, alpha) {
     *          this._num = num;
     *          this._alpha = alpha;
     *      },
     *      [["red", [0, 0.125]], ["green", [1, 0.125]], ["blue", [2, 0.125]], [Symbol("violet"), [123, 0.5]]]
     *  );
     *
     *  @param {Function} protoHandler
     *  @param {Function} ctor
     *  @param {iterable} pairs
     *  @returns {karbonator.util.Enum}
     */
    MyEnum.create = function (protoHandler, ctor, pairs)
    {
        if(!isFunction(protoHandler))
        {
            throw new TypeError("The parameter 'protoHandler' must be a function.");
        }

        if(!isFunction(ctor))
        {
            throw new TypeError("The parameter 'ctor' must be a function.");
        }

        if(!isIterable(pairs))
        {
            throw new TypeError(
                "The parameter "
                + "'pairs'"
                + " must have a property "
                + "'Symbol.iterator'."
            );
        }

        var EnumType = ctor;
        var proto = Object.create(MyEnum.prototype);
        protoHandler(proto, ctor);
        EnumType.prototype = proto;

        var keys = [];
        for(
            var i = pairs[Symbol.iterator](), iP = i.next(), ndx = 0;
            !iP.done;
            iP = i.next(), ++ndx
        )
        {
            var key = iP.value[0];
            if(!isString(key) && !isSymbol(key))
            {
                throw new TypeError("Keys of enum members must be strings or symbols.");
            }
            if(_hasOwnProperty.call(EnumType, key))
            {
                throw new Error(
                    "The key '"
                    + key
                    + "' already exists."
                );
            }
            keys.push(key);

            EnumType[key] = Reflect.construct(EnumType, iP.value[1]);
            EnumType[key][_pSymMemberIndex] = ndx;
            EnumType[key][_pSymMemberKey] = key;
        }
        EnumType[_pSymStaticKeys] = keys;

        EnumType[Symbol.iterator] = function ()
        {
            return ({
                _keys : EnumType[_pSymStaticKeys],

                _index : 0,

                next : function ()
                {
                    var result = {
                        done : this._index >= this._keys.length
                    };

                    if(!result.done)
                    {
                        var key = this._keys[this._index];
                        result.value = [
                            this._keys[this._index],
                            EnumType[key]
                        ];

                        ++this._index;
                    }

                    return result;
                }
            });
        };

        return EnumType;
    };

    /**
     *  @param {Function} enumType
     *  @returns {Array.<String|Symbol>}
     */
    MyEnum.getKeys = function (enumType)
    {
        MyEnum._assertIsEnumType(enumType);

        return enumType[_pSymStaticKeys].slice();
    };

    /**
     *  @param {Function} enumType
     *  @param {number} index
     *  @returns {String|Symbol}
     */
    MyEnum.getKeyAt = function (enumType, index)
    {
        MyEnum._assertIsEnumType(enumType);

        return enumType[_pSymStaticKeys][index];
    };

    /**
     *  @param {Function} enumType
     *  @param {number} index
     *  @returns {*}
     */
    MyEnum.getValueAt = function (enumType, index)
    {
        MyEnum._assertIsEnumType(enumType);

        return MyEnum.findByKey(enumType, MyEnum.getKeyAt(enumType, index));
    };

    /**
     *  @param {Function} enumType
     *  @returns {number}
     */
    MyEnum.getCount = function (enumType)
    {
        MyEnum._assertIsEnumType(enumType);

        return enumType[_pSymStaticKeys].length;
    };

    /**
     *  @param {Function} enumType
     *  @param {String|Symbol} key
     *  @returns {karbonator.util.Enum}
     */
    MyEnum.findByKey = function (enumType, key)
    {
        MyEnum._assertIsEnumType(enumType);

        if(!_hasOwnProperty.call(enumType, key))
        {
            throw new Error(
                "The enum member '"
                + key
                + "' doesn't exist."
            );
        }

        return enumType[key];
    };

    /**
     *  @param {Object} enumType
     *  @returns {Object}
     */
    MyEnum._assertIsEnumType = function (enumType)
    {
        if(!isFunction(enumType))
        {
            throw new TypeError(
                "The paramter 'enumType'"
                + " must be a derived type of "
                + "'karbonator.util.Enum'."
            );
        }

        return enumType;
    };

    return {
        MyEnum : MyEnum
    };
})();
