var isUndefined = require("kaphein-js").isUndefined;
var isString = require("kaphein-js").isString;
var isFunction = require("kaphein-js").isFunction;
var forOf = require("kaphein-js").forOf;
var RbTreeMap = require("kaphein-js").RbTreeMap;
var ArrayMap= require("kaphein-js").ArrayMap;

var integerComparator = require("./utils").integerComparator;
// var stringComparator = require("./utils").stringComparator;
var isNonNegativeSafeInteger = require("./utils").isNonNegativeSafeInteger;
var OperatorTypeKeys = require("./regex-parser").OperatorTypeKeys;
var OperatorType = require("./regex-parser").OperatorType;
var Operator = require("./regex-parser").Operator;
var AstNode = require("./regex-parser").AstNode;
var RegexParser = require("./regex-parser").RegexParser;
var CodeEmitter = require("./regex-parser").CodeEmitter;
var RegexVm = require("./regex-vm").RegexVm;

module.exports = (function ()
{
    /**
     *  @constructor
     */
    function Lexer()
    {
        /**  @type {RbTreeMap<number, LexerTokenDefinition>} */this._keyTokenMap = new RbTreeMap(null, integerComparator);
        /** @type {Map<string, number>} */this._nameKeyMap = new ArrayMap();
        this._regexVm = new RegexVm();

        this._inStr = "";
        this._pos = 0;
        this._scannedTokenCount = 0;
        this._prevResult = null;
    }

    Lexer.prototype = {
        constructor : Lexer,

        /**
         *  @param {number|string} arg0
         *  @param {LexerToken|null}
         */
        getToken : function getToken(arg0)
        {
            var key = arg0;
            if(isString(arg0)) {
                key = this._nameKeyMap.get(arg0);
                if(isUndefined(key)) {
                    return null;
                }
            }
            else if(!isNonNegativeSafeInteger(arg0)) {
                throw new TypeError("A non-negative integer or a string must be passed.");
            }

            var token = this._keyTokenMap.get(key);
            if(isUndefined(token)) {
                token = null;
            }

            return token;
        },

        /**
         *  @param {string} str
         */
        setInput : function (str)
        {
            if(!isString(str)) {
                throw new TypeError("'str' must be a string.");
            }
            this._inStr = str;
            this.rewind();
        },

        /**
         *  @param {Function} callback
         */
        scanNext : function scanNext(callback)
        {
            if(!isFunction(callback)) {
                throw new TypeError("'callback' must be a function.");
            }

            var hasNext = true;

            var result = this._regexVm.find(this._inStr, this._pos);
            if(null !== result) {
                if(
                    null === this._prevResult
                    || !this._prevResult.equals(result)
                ) {
                    this._pos = result.range.getMaximum();

                    callback(result, this._scannedTokenCount, this);

                    this._prevResult = result;
                    ++this._scannedTokenCount;
                }
                else {
                    hasNext = false;
                }
            }
            else {
                ++this._pos;

                if(this._pos >= this._inStr.length) {
                    hasNext = false;
                }
            }

            return hasNext;
        },

        rewind : function rewind()
        {
            this._scannedTokenCount = 0;
            this._pos = 0;
            this._prevResult = null;
        }
    };

    /**
     *  @constructor
     *  @param {number} key
     *  @param {string} name
     *  @param {string} regexText
     *  @param {boolean} subRoutineOnly
     */
    function LexerToken(key, name, regexText, subRoutineOnly)
    {
        if(!isNonNegativeSafeInteger(key)) {
            throw new TypeError("'key' must be a non-negative safe integer.");
        }
        if(!isString(name)) {
            throw new TypeError("'name' must be a string.");
        }
        if(!isString(regexText)) {
            throw new TypeError("'regexText' must be a string.");
        }

        this.key = key;
        this.name = name;
        this.regexText = regexText;
        this.subRoutineOnly = !!subRoutineOnly;
    }

    LexerToken.prototype = {
        constructor : LexerToken,

        toString : function toString()
        {
            var str = '{';
    
            str += "key";
            str += " : ";
            str += this.key;
    
            str += ", ";
            str += "name";
            str += " : ";
            str += "\"" + this.name + "\"";
    
            str += ", ";
            str += "regexText";
            str += " : ";
            str += "\"" + this.regexText + "\"";
    
            str += ", ";
            str += "subRoutineOnly";
            str += " : ";
            str += this.subRoutineOnly;
    
            str += '}';

            return str;
        }
    };

    /**
     *  @constructor
     */
    function LexerGenerator()
    {
        this._keySeq = 0;
        /** @type {RbTreeMap<number, LexerTokenDefinition>} */this._keyTokenMap = new RbTreeMap(null, integerComparator);
        /** @type {Map<string, number>} */this._nameKeyMap = new ArrayMap();
        this._regexParser = new RegexParser();
        this._bytecodeEmitter = new CodeEmitter();
    }

    LexerGenerator.prototype = {
        constructor : LexerGenerator,

        getTokenCount : function getTokenCount()
        {
            return this._nameKeyMap.getElementCount();
        },

        /**
         *  @param {string} name
         */
        getTokenDefinition : function getToken(name)
        {
            if(this._nameKeyMap.has(name)) {
                return this._keyTokenMap.get(this._nameKeyMap.get(name));
            }
        },

        /**
         *  @param {string} name
         *  @param {string} regexText
         *  @param {boolean} [subRoutineOnly=false]
         */
        defineToken : function defineToken(name, regexText)
        {
            var tokenKey = this._nameKeyMap.get(name);
            if(isUndefined(tokenKey)) {
                tokenKey = this._keySeq;
                ++this._keySeq;

                this._nameKeyMap.set(name, tokenKey);
            }

            var astRootNode = this._regexParser.parse(
                regexText,
                tokenKey, this._nameKeyMap
            );
            if(null === astRootNode) {
                this._nameKeyMap.remove(name);
                --this._keySeq;

                throw new Error(this._regexParser._error.message);
            }

            var newToken = new LexerTokenDefinition(
                tokenKey, name,
                regexText,
                arguments[2],
                astRootNode
            );
            this._keyTokenMap.set(tokenKey, newToken);

            return tokenKey;
        },

        /**
         *  @param {string} name
         */
        undefineToken : function undefineToken(name)
        {
            this._nameKeyMap.remove(name);
        },

        undefineAllTokens : function undefineAllTokens()
        {
            this._nameKeyMap.clear();
            this._keyTokenMap.clear();
            this._keySeq = 0;
        },

        generate : function generate()
        {
            var regexStr = "";
            var rootNode = new AstNode(
                RegexParser.AstNodeType.operator,
                new Operator(
                    OperatorType.valueOf(OperatorTypeKeys.regexAlternation)
                )
            );
            forOf(
                this._keyTokenMap,
                function (pair)
                {
                    var token = pair[1];
                    regexStr += (regexStr === "" ? "" : "|||");
                    if(token._subRoutineOnly) {
                        regexStr += "(@{subRoutineOnly}" + token._regexText + ')';
                    }
                    else {
                        regexStr += token._regexText;
                    }
                    regexStr += "(@{accept}{" + token._key + '})';
                    rootNode.addChild(token._astRootNode);
                },
                this
            );

            var lexer = new Lexer();
            var bytecode = this._bytecodeEmitter.emitCode(
                rootNode,
                this._keyTokenMap
            );
            bytecode._regexStr = regexStr;
            lexer._regexVm._bytecode = bytecode;

            forOf(
                this._keyTokenMap,
                function (pair)
                {
                    var key = pair[0];
                    var token = pair[1];
                    this._keyTokenMap.set(
                        key,
                        new LexerToken(
                            key, token._name,
                            token._regexText,
                            token._subRoutineOnly
                        )
                    );
                    this._nameKeyMap.set(token._name, key);
                },
                lexer
            );

            return lexer;
        }
    };

    /**
     *  @constructor
     *  @param {number} key
     *  @param {string} name
     *  @param {string} regexText
     *  @param {boolean} subRoutineOnly
     *  @param {AstNode} astRootNode
     */
    function LexerTokenDefinition(
        key, name,
        regexText,
        subRoutineOnly,
        astRootNode
    )
    {
        this._key = key;
        this._name = name;
        this._regexText = regexText;
        this._subRoutineOnly = subRoutineOnly;
        this._astRootNode = astRootNode;
    }

    LexerTokenDefinition.prototype = {
        constructor : LexerTokenDefinition,

        toString : function toString()
        {
            var str = '{';

            str += "key";
            str += " : ";
            str += this._key;
    
            str += ", ";
            str += "name";
            str += " : ";
            str += this._name;
    
            str += ", ";
            str += "regex";
            str += " : ";
            str += this._regexText;
    
            str += ", ";
            str += "subRoutineOnly";
            str += " : ";
            str += this._subRoutineOnly;
    
            str += ", ";
            str += "ast";
            str += " : ";
            str += this._astRootNode;
    
            str += '}';
    
            return str;
        }
    };

    return {
        Lexer : Lexer,
        LexerGenerator : LexerGenerator
    };
})();
