var isUndefined = require("kaphein-js").isUndefined;
var isUndefinedOrNull = require("kaphein-js").isUndefinedOrNull;
var isIterable = require("kaphein-js").isIterable;
var isString = require("kaphein-js").isString;
var RbTreeMap = require("kaphein-js").RbTreeMap;
var Interval = require("kaphein-js-math").Interval;

var isNonNegativeSafeInteger = require("./utils").isNonNegativeSafeInteger;
var integerComparator = require("./utils").integerComparator;
var utils = require("./utils");
var ByteArray = require("./byte-array").ByteArray;
var bytesToInteger = require("./byte-array").bytesToInteger;
var integerToBytes = require("./byte-array").integerToBytes;
var MatchResult = require("./match-result").MatchResult;
var MyEnum = require("./my-enum").MyEnum;

module.exports = (function ()
{
    /**
     *  @constructor
     */
    function RegexVm()
    {
        this._inStr = "";
        this._bytecode = null;

        this._cursor = 0;
        this._thIdSeq = 0;
        /**  @type {RegexVmThread[]} */this._ctxts = [];
        this._logStr = "";
    }

    /**
     *  @constructor
     */
    RegexVm._IntegerType = MyEnum.create(
        /**
         *  @param {Object} proto
         */
        function (proto) {
            proto.getByteCount = function () {
                return this._byteCount;
            };

            proto.bytesToValue = function (bytes) {
                return bytesToInteger(
                    bytes,
                    this._byteCount, this._signed,
                    arguments[1],
                    arguments[2]
                );
            };

            proto.valueToBytes = function (v) {
                return integerToBytes(
                    v, this._byteCount,
                    arguments[1],
                    arguments[2], arguments[3]
                );
            };
        },
        function (byteCount, signed) {
            this._byteCount = byteCount;
            this._signed = signed;
        },
        [
            ["uint8", [1, false]],
            ["int16", [2, true]],
            ["uint16", [2, false]],
            ["int32", [4, true]],
            ["uint32", [4, false]]
        ]
    );

    /**
     *  @constructor
     */
    RegexVm.OperandType = MyEnum.create(
        /**
         *  @param {Object} proto
         */
        function (proto) {
            proto.getByteCount = function () {
                return this._typeMeta.getByteCount();
            };

            proto.valueToBytes = function (v) {
                return this._typeMeta.valueToBytes(
                    v,
                    arguments[1],
                    arguments[2], arguments[3]
                );
            };

            proto.toString = function () {
                var str = '{';

                str += "name";
                str += " : ";
                str += this[MyEnum.getKey]();

                str += '}';

                return str;
            };
        },
        function (typeMeta) {
            this._typeMeta = typeMeta;
        },
        [
            ["offset", [RegexVm._IntegerType.int16]],
            ["address", [RegexVm._IntegerType.uint32]],
            ["byteIndex", [RegexVm._IntegerType.uint8]],
            ["index", [RegexVm._IntegerType.uint32]],
            ["characterCode", [RegexVm._IntegerType.uint32]],
            ["integerLiteral", [RegexVm._IntegerType.uint32]]
        ]
    );

    /**
     *  @constructor
     */
    var RegexVmInstruction = MyEnum.create(
        /**
         *  @param {Object} proto
         */
        function (proto) {
            /**
             *  @function
             *  @returns {number}
             */
            proto.getOpCode = function () {
                return this._opCode;
            };

            /**
             *  @function
             *  @returns {number}
             */
            proto.getOperandCount = function () {
                return this._operandTypes.length;
            };

            /**
             *  @function
             *  @param {number} index
             *  @returns {RegexVm.OperandType}
             */
            proto.getOperandTypeAt = function (index) {
                if(
                    !isNonNegativeSafeInteger(index)
                    || index >= this._operandTypes.length
                ) {
                    throw new RangeError("Index out of range.");
                }

                return this._operandTypes[index];
            };

            /**
             *  @function
             *  @param {number} index
             *  @returns {number}
             */
            proto.getOperandSizeAt = function (index) {
                return this.getOperandTypeAt(index).getByteCount();
            };

            /**
             *  @function
             *  @returns {number}
             */
            proto.getSize = function () {
                return 1 + this._operandTypes.reduce(
                    function (acc, current) {
                        return acc + current.getByteCount();
                    },
                    0
                );
            };

            /**
             *  @function
             *  @returns {string}
             */
            proto.getMnemonic = function () {
                return this._mnemonic;
            };

            /**
             *  @function
             *  @returns {string}
             */
            proto.toString = function () {
                var str = "{";

                str += "opCode";
                str += " : ";
                str += this._opCode.toString(16);

                str += ", ";
                str += "operandTypes";
                str += " : ";
                str += "[" + this._operandTypes + "]";

                str += ", ";
                str += "mnemonic";
                str += " : ";
                str += "\"" + this._mnemonic + "\"";

                str += "}";

                return str;
            };
        },
        function (mnemonic, opCode, operandTypes) {
            if(!isString(mnemonic)) {
                throw new TypeError("The parameter 'mnemonic' must be a string.");
            }
            if(!isNonNegativeSafeInteger(opCode)) {
                throw new TypeError("The parameter 'opCode' must be a non-negative safe integer.");
            }
            if(null !== operandTypes && !Array.isArray(operandTypes)) {
                throw new TypeError("The parameter 'operandTypes' must be an array of type meta objects.");
            }

            this._opCode = opCode;
            this._operandTypes = (null === operandTypes ? [] : operandTypes);
            this._mnemonic = mnemonic;
        },
        Array.from(
            [
                [
                    "bra",
                    0x00,
                    [RegexVm.OperandType.offset]
                ],
                [
                    "bsr",
                    0x01,
                    [RegexVm.OperandType.offset]
                ],
                [
                    "reserved02",
                    0x02,
                    null
                ],
                [
                    "reserved03",
                    0x03,
                    null
                ],
                [
                    "jmp",
                    0x04,
                    [RegexVm.OperandType.address]
                ],
                [
                    "jsr",
                    0x05,
                    [RegexVm.OperandType.address]
                ],
                [
                    "rts",
                    0x06,
                    null
                ],
                [
                    "accept",
                    0x07,
                    [RegexVm.OperandType.integerLiteral]
                ],
                [
                    "fork",
                    0x08,
                    [
                        RegexVm.OperandType.offset,
                        RegexVm.OperandType.offset
                    ]
                ],
                [
                    "pfork",
                    0x09,
                    [
                        RegexVm.OperandType.offset,
                        RegexVm.OperandType.offset
                    ]
                ],
                [
                    "skip",
                    0x0A,
                    null
                ],
                [
                    "consume",
                    0x0B,
                    null
                ],
                [
                    "reserved0C",
                    0x0C,
                    [RegexVm.OperandType.characterCode]
                ],
                [
                    "reserved0D",
                    0x0D,
                    [RegexVm.OperandType.characterCode]
                ],
                [
                    "begin.group",
                    0x0E,
                    [RegexVm.OperandType.byteIndex]
                ],
                [
                    "end.group",
                    0x0F,
                    [RegexVm.OperandType.byteIndex]
                ],
                [
                    "test.code",
                    0x10,
                    [RegexVm.OperandType.characterCode]
                ],
                [
                    "reserved11",
                    0x11,
                    null
                ],
                [
                    "test.range",
                    0x12,
                    [RegexVm.OperandType.index]
                ],
                [
                    "test.ranges",
                    0x13,
                    [RegexVm.OperandType.index]
                ]
            ],
            function (current) {
                return ([
                    current[0].replace(
                        /(\.[A-Za-z0-9]+)/g,
                        function (text) {
                            return text[1].toUpperCase() + text.substring(2);
                        }
                    ),
                    current
                ]);
            }
        )
    );

    /**
     *  @readonly
     *  @type {Map<number, [number, any]>}
     */
    RegexVm._opCodeInstMap = new RbTreeMap(
        Array.from(
            RegexVmInstruction,
            /**
             *  @param {Array} enumPair
             */
            function (enumPair)
            {
                var inst = enumPair[1];
                return [inst.getOpCode(), inst];
            }
        ),
        integerComparator
    );

    /**
     *  @param {number} opCode
     *  @returns {RegexVmInstruction}
     */
    RegexVm.findInstructionByOpCode = function (opCode) {
        if(!isNonNegativeSafeInteger(opCode)) {
            throw new TypeError("'opCode' must be a non-negative safe integer.");
        }

        var inst = RegexVm._opCodeInstMap.get(opCode);
        if(isUndefined(inst)) {
            throw new Error(
                "The opcode '"
                + opCode.toString(16)
                + "' doesn't exist."
            );
        }

        return inst;
    };

    /**
     *  @function
     *  @param {RegexVmBytecode} bytecode
     */
    RegexVm.prototype.setBytecode = function (bytecode) {
        this._bytecode = bytecode;
    };

    /**
     *  @function
     *  @param {string} str
     *  @param {number} [start=0]
     *  @returns {MatchResult|null}
     */
    RegexVm.prototype.find = function (str) {
        if(isUndefinedOrNull(this._bytecode)) {
            throw new Error("Set the bytecode of the regex first.");
        }

        if(!isString(str)) {
            throw new TypeError("'str' must be a string.");
        }        
        this._inStr = str;

        var start = arguments[1];
        if(isUndefined(start)) {
            start = 0;
        }
        else if(!isNonNegativeSafeInteger(start)) {
            throw new TypeError("'start' must be a non-negative safe integer.");
        }

        return this._run(start);
    };

    /**
     *  @function
     *  @param {string} str
     *  @param {number} [start=0]
     *  @param {number} [end]
     *  @returns {Array<MatchResult>}
     */
    RegexVm.prototype.findAll = function (str) {
        if(isUndefinedOrNull(this._bytecode)) {
            throw new Error("Set the bytecode of the regex first.");
        }

        if(!isString(str)) {
            throw new TypeError("'str' must be a string.");
        }
        this._inStr = str;

        var start = arguments[1];
        if(isUndefined(start)) {
            start = 0;
        }
        else if(!isNonNegativeSafeInteger(start)) {
            throw new TypeError("'start' must be a non-negative safe integer.");
        }

        var end = arguments[2];
        if(isUndefined(end)) {
            end = this._inStr.length;
        }
        else if(!isNonNegativeSafeInteger(end)) {
            throw new TypeError("'end' must be a non-negative safe integer.");
        }

        var results = [];
        for(var i = start; ; ) {
            var result = this._run(i);
            if(null !== result) {
                if(
                    results.length > 0
                    && result.equals(results[results.length - 1])
                ) {
                    break;
                }

                results.push(result);

                i = result.range.getMaximum();
            }
            else {
                ++i;

                if(i >= end) {
                    break;
                }
            }
        }

        return results;
    };

    /**
     *  @private
     *  @function
     *  @param {number} startIndex
     *  @returns {MatchResult}
     */
    RegexVm.prototype._run = function (startIndex) {
        this._cursor = startIndex;

        this._thIdSeq = 0;
        this._ctxts.length = 0;
        var finalMatchThreadFound = false;
        var matchThread = null;

        this._logStr = "";

        this.createThread(0);

        var i = 0, j = 0;
        var th = null;

        var aliveThreads = [];
        var acceptedThreads = [];
        var deadThreads = [];
        for(
            ;
            this._ctxts.length > 0 && !finalMatchThreadFound;//;//
            ++this._cursor
        ) {
            for(i = 0; i < this._ctxts.length; ++i) {
                th = this._ctxts[i];
                while(!th.isDead()) {
                    th.execute();
                    this._logStr += this.createExecInfoDebugMessage(th) + "\r\n";

                    if(((th._lastOpCode & 0xF0) >>> 4) === 1) {
                        break;
                    }
                }

                if(th.isDead()) {
                    if(null === th._matchResult){
                        deadThreads.push(th);
                    }
                    else {
                        acceptedThreads.push(th);
                    }
                }
                else {
                    var addCurrent = true;
                    for(j = aliveThreads.length; j > 0; ) {
                        --j;

                        var aliveThread = aliveThreads[j];
                        if(th.hasSamePathPostfixWith(aliveThread)) {
                            if(th.isPriorTo(aliveThread)) {
                                aliveThreads.splice(j, 1);
                            }
                            else {
                                addCurrent = false;
                                break;
                            }
                        }
                    }

                    if(addCurrent) {
                        aliveThreads.push(th);
                    }

//                    aliveThreads.push(th);
                }

                this._logStr += ".............................." + "\r\n";

                //debugger;
            }

            var tempTh = this._ctxts;
            this._ctxts = aliveThreads;
            aliveThreads = tempTh;
            aliveThreads.length = 0;

            this._logStr += "threads(" + this._ctxts.length + ") === [" + "\r\n";
            for(i = 0; i < this._ctxts.length; ++i) {
                th = this._ctxts[i];
                this._logStr += 'T' + th._id + '(' + '[' + _createConsumedValuesDebugString(th._consumedValues) + ']' + ')' + "\r\n";
            }
            this._logStr += ']';
            if(this._ctxts.length < 1) {
                this._logStr += "\r\n";
            }

//            if(acceptedThreads.length > 0) {
//                debugger;
//            }

            for(i = acceptedThreads.length; i > 0; ) {
                --i;

                th = acceptedThreads[i];

                this._logStr += this.createMatchResultDebugMessage(th)
                    + "\r\n"
                ;

                if(null === matchThread) {
                    matchThread = th;

                    finalMatchThreadFound = true;
                    for(j = this._ctxts.length; finalMatchThreadFound && j > 0; ) {
                        --j;

                        finalMatchThreadFound = !this._ctxts[j].isPriorTo(th);
                    }
                }
                else {
                    if(th.isPriorTo(matchThread)) {
                        matchThread = th;

                        this._logStr += 'T' + th._id + " is prior to the selected thread." + "\r\n";
                    }

                    var priorToAlivingThs = true;
                    for(j = 0; priorToAlivingThs && j < this._ctxts.length; ++j) {
                        priorToAlivingThs = th.isPriorTo(this._ctxts[j]);
                    }
                    if(priorToAlivingThs) {
                        finalMatchThreadFound = true;

                        this._logStr += 'T' + th._id + " is prior to aliving threads." + "\r\n";
                    }
                }
            }
            acceptedThreads.length = 0;
            deadThreads.length = 0;

            if(null !== matchThread) {
                for(i = this._ctxts.length; i > 0; ) {
                    --i;

                    th = this._ctxts[i];
                    if(th.comparePriorityTo(matchThread) >= 0) {
                        aliveThreads.push(th);
                    }
                }

                var temp = this._ctxts;
                this._ctxts = aliveThreads;
                aliveThreads = temp;
                aliveThreads.length = 0;

                this._logStr += "selectedResult === "
                    + this.createMatchResultDebugMessage(matchThread)
                    + "\r\n"
                ;
            }

            this._logStr += "\r\n";
            this._logStr += "------------------------------" + "\r\n";

            //debugger;
        }

        this._logStr += (null === matchThread ? "Failed..." : "Found!!!") + "\r\n";
        this._logStr += "==============================" + "\r\n";

        //console.log(this._logStr);

        return (null !== matchThread ? matchThread._matchResult : null);
    };

    /**
     *  @param {number[][]} values
     *  @returns {string}
     */
    var _createConsumedValuesDebugString = function (values) {
        var str = "";

        for(var i = 0; i < values.length; ++i) {
            var value = values[i];

            switch(value[0]) {
            case 0:
                str += '\'' + String.fromCharCode(value[1]) + '\'';
            break;
            case 1:
                str += '{' + (value[1] >= 0 ? '+' : '') + value[1] + '}';
            break;
            case 2:
                str += '(' + value[1];
            break;
            case 3:
                str += ')' + value[1];
            break;
            }
        }

        return str;
    };

    /**
     *  @param {number} pc
     *  @param {RegexVmThread} [parent]
     *  @param {noolean} [prioritize=false]
     *  @returns {RegexVmThread}
     */
    RegexVm.prototype.createThread = function (pc) {
        var parent = arguments[1];

        var newThreadId = this._thIdSeq;
        ++this._thIdSeq;

        var newThread = (
            !isUndefinedOrNull(parent)
            ? new RegexVmThread(
                this, newThreadId, pc,
                parent,
                parent._pc - RegexVmInstruction.fork.getSize(),
                arguments[2]
            )
            : new RegexVmThread(this, newThreadId, pc)
        );
        this._ctxts.push(newThread);

        return newThread;
    };

    /**
     *  @param {number} code
     *  @returns {boolean}
     */
    RegexVm.prototype.inputMatchesCode = function (code) {
        return code === this.getCurrentCharacterCode();
    };

    /**
     *  @function
     *  @param {number} index
     *  @returns {boolean}
     */
    RegexVm.prototype.inputIsInRange = function (index) {
        if(index >= this._bytecode._ranges.length) {
            return false;
        }

        return this._bytecode._ranges[index].contains(
            this.getCurrentCharacterCode()
        );
    };

    /**
     *  @function
     *  @param {number} index
     *  @returns {boolean}
     */
    RegexVm.prototype.inputIsInRangeSet = function (index) {
        if(index >= this._bytecode._rangeIndexSets.length) {
            return false;
        }

        var current = this.getCurrentCharacterCode();
        var rangeIndexSet = this._bytecode._rangeIndexSets[index];
        for(var i = 0; i < rangeIndexSet.length; ++i) {
            var range = this._bytecode._ranges[rangeIndexSet[i]];
            if(range.contains(current)) {
                return true;
            }
        }

        return false;
    };

    /**
     *  @function
     *  @returns {number}
     */
    RegexVm.prototype.getCurrentCharacterCode = function () {
        var code = (
            this._cursor < this._inStr.length
            ? this._inStr.charCodeAt(this._cursor)
            : -1
        );

        return code;
    };

    /**
     *  @param {RegexVmThread} matchThread
     *  @returns {string}
     */
    RegexVm.prototype.createMatchResultDebugMessage = function (matchThread) {
        return 'T' + matchThread._id
            + '(' + '[' + _createConsumedValuesDebugString(matchThread._consumedValues) + ']' + ')'
            + "."
            + "result === "
            + matchThread._matchResult.toString()
        ;
    };

    /**
     *  @param {RegexVmThread} th
     *  @returns {string}
     */
    RegexVm.prototype.createExecInfoDebugMessage = function (th) {
        var inst = RegexVm.findInstructionByOpCode(th._lastOpCode);
        if(isUndefined(inst)) {
            throw new Error("An invalid opcode has been found.");
        }

        var debugStr = 'T' + th._id;
        debugStr += '(';
        debugStr += '[' + _createConsumedValuesDebugString(th._consumedValues) + ']';
        debugStr += ')';

        var mnemonic = inst.getMnemonic();
        debugStr += " " + (th._instAddr) + ":";
        debugStr += "\t" + mnemonic;

        if(mnemonic.endsWith("fork")) {
            debugStr += " " + "parent : T" + th._id;
            debugStr += '(' + th._pc + ')';
            var childTh = th._vm._ctxts[th._vm._ctxts.length - 1];
            debugStr += ", child : T" + childTh._id;
            debugStr += '(' + childTh._pc + ')';
        }
        else if(mnemonic.startsWith("test")) {
            var cursor = th._vm._cursor;
            debugStr += "\t" + "at " + cursor + " " + th._vm._inStr.charAt(cursor);
        }

        return debugStr;
    };

    /**
     *  @constructor
     *  @param {RegexVm} vm
     *  @param {number} id
     *  @param {number} pc
     *  @param {RegexVmThread} [parent]
     *  @param {number} [forkKey]
     *  @param {boolean} [prioritize]
     */
    function RegexVmThread(vm, id, pc)
    {
        if(!(vm instanceof RegexVm)) {
            throw new TypeError("'vm' must be an instance of 'RegexVm'.");
        }
        if(!isNonNegativeSafeInteger(id)) {
            throw new TypeError("'id' must be a non-negative safe integer.");
        }
        if(!isNonNegativeSafeInteger(pc)) {
            throw new TypeError("'pc' must be a non-negative safe integer.");
        }

        this._vm = vm;
        this._id = id;
        this._initialPc = pc;
        this._pc = pc;
        this._matchResult = null;

        var parent = arguments[3];
        var forkKey = arguments[4];
        if(
            (parent instanceof RegexVmThread)
            && isNonNegativeSafeInteger(forkKey)
        ) {
            var parentFrameStack = parent._frameStack;
            var i = parentFrameStack.length;
            var newThFrameStack = new Array(i);
            while(i > 0) {
                --i;
                newThFrameStack[i] = new RegexVmFrame(
                    parentFrameStack[i]
                );
            }
            this._frameStack = newThFrameStack;

            var parentPath = parent._path;
            parentPath.push([forkKey, 0, 0]);
            var lastNdx = parentPath.length - 1;
            var newThPath = utils._copyTwoDimIntArray(parentPath);
            parentPath[lastNdx][1] = +!!arguments[5];
            this._path = newThPath;

            this._consumeRanges = utils._copyIntArray(parent._consumeRanges);

            this._groupNdxStack = utils._copyIntArray(parent._groupNdxStack);

            parent._consumedValues.push([1, -forkKey]);
            this._consumedValues = utils._copyTwoDimIntArray(parent._consumedValues);
            parent._consumedValues[parent._consumedValues.length - 1][1] = (+!!arguments[5] ? forkKey : -forkKey);

            this._instAddr = parent._instAddr;
            this._lastOpCode = parent._lastOpCode;
        }
        else {
            this._frameStack = [new RegexVmFrame(0)];
            this._path = [];
            this._consumeRanges = [vm._cursor];

            this._groupNdxStack = [];

            this._consumedValues = [];

            this._instAddr = 0;
            this._lastOpCode = 0x00;
        }
    }

    /**
     *  @readonly
     */
    RegexVmThread._skipDelimiter = 0;

    /**
     *  @returns {MatchResult}
     */
    RegexVmThread.prototype.getMatchResult = function () {
        return this._matchResult;
    };

    /**
     *  @param {RegexVmThread} rhs
     *  @returns {boolean}
     */
    RegexVmThread.prototype.comparePriorityTo = function (rhs) {
        var thisPath = this._path;
        var rhsPath = rhs._path;
        var thisPathLen = thisPath.length;
        var rhsPathLen = rhsPath.length;

        var lenDiff = thisPathLen - rhsPathLen;
        var minLen = (lenDiff < 0 ? thisPathLen : rhsPathLen);

        for(var i = 0; i < minLen; ++i) {
            var lhsPoint = thisPath[i];
            var rhsPoint = rhsPath[i];

            if(lhsPoint[0] !== rhsPoint[0]) {
                break;
            }

            var priorityDiff = lhsPoint[1] - rhsPoint[1];
            if(priorityDiff !== 0) {
                return priorityDiff;
            }
        }

        switch(
            (this._frameStack.length < 1 ? 0x02 : 0)
            | (rhs._frameStack.length < 1 ? 0x01 : 0)
        ) {
        case 0x00:
            //Select the shortest path.
            return -lenDiff;
        //break;
        case 0x01:
            return 1;
        //break;
        case 0x02:
            return -1;
        //break;
        case 0x03:
            var lhsResult = this._matchResult;
            var rhsResult = rhs._matchResult;
            switch(
                (null !== lhsResult ? 0x02 : 0)
                | (null !== rhsResult ? 0x01 : 0)
            ) {
            case 0:
                return lenDiff;
            //break;
            case 1:
                return -1;
            //break;
            case 2:
                return 1;
            //break;
            case 3:
                //Select the longest matched one.
                var matchedTextDiff = lhsResult.text.length - rhsResult.text.length;
                if(matchedTextDiff !== 0) {
                    return matchedTextDiff;
                }

                //If that failed, then select the shortest path.
                return -lenDiff;
            //break;
            }
        //break;
        }
    };

    /**
     *  @param {RegexVmThread} rhs
     *  @returns {boolean}
     */
    RegexVmThread.prototype.isPriorTo = function (rhs) {
        return this.comparePriorityTo(rhs) > 0;
    };

    /**
     *  @param {RegexVmThread} rhs
     *  @returns {boolean}
     */
    RegexVmThread.prototype.hasSamePathPostfixWith = function (rhs) {
        var lhsPath = this._path;
        var rhsPath = rhs._path;

        var lhsPathLen = lhsPath.length;
        var rhsPathLen = rhsPath.length;

        var count = 0;
        for(
            var l = lhsPathLen, r = rhsPathLen;
            l > 0 && r > 0;
        ) {
            --l;
            --r;

            var lhsPoint = lhsPath[l];
            var rhsPoint = rhsPath[r];
            if(
                lhsPoint[0] !== rhsPoint[0]
                || lhsPoint[1] !== rhsPoint[1]
                || lhsPoint[2] !== rhsPoint[2]
            ) {
                break;
            }

            ++count;
        }

        return count > 0;
    };

    /**
     *  @function
     */
    RegexVmThread.prototype.execute = function () {
        var opCode = this.readOpCode();
        switch(opCode) {
        case 0x00:
            this.branch();
        break;
        case 0x01:
            throw new Error("A not implemented opcode has been found.");
        // break;
        case 0x02:
        case 0x03:
            throw new Error("An invalid opcode has been found.");
        // break;
        case 0x04:
            throw new Error("A not implemented opcode has been found.");
        // break;
        case 0x05:
            this.jumpToSubroutine();
        break;
        case 0x06:
            this.returnFromSubroutine();
        break;
        case 0x07:
            this.accept();
        break;
        case 0x08:
        case 0x09:
            this.fork((opCode & 0x01) !== 0);
        break;
        case 0x0A:
        case 0x0B:
            this.moveConsumePointer((opCode & 0x01) !== 0);
        break;
        case 0x0C:
        case 0x0D:
            throw new Error("An invalid opcode has been found.");
        // break;
        case 0x0E:
            this.beginGroup();
        break;
        case 0x0F:
            this.endGroup();
        break;
        case 0x10:
            this.testCode();
        break;
        case 0x11:
            throw new Error("An invalid opcode has been found.");
        // break;
        case 0x12:
            this.testRange();
        break;
        case 0x13:
            this.testRanges();
        break;
        default:
            throw new Error("An invalid opcode has been found.");
        }
    };

    /**
     * Reads the next opcode from the bytecode and increment the pc.
     * 
     *  @returns {number}
     */
    RegexVmThread.prototype.readOpCode = function () {
        this._instAddr = this._pc;

        var opCode = this.readInteger(false, 1);
        this._lastOpCode = opCode;

        return opCode;
    };

    /**
     * Reads the next integer value from the bytecode and increment the pc.
     * 
     *  @param {boolean} signed
     *  @param {number} byteCount
     *  @returns {number}
     */
    RegexVmThread.prototype.readInteger = function (signed, byteCount) {
        var intValue = this._vm._bytecode.readInteger(this._pc, signed, byteCount);

        this._pc += byteCount;

        return intValue;
    };

    RegexVmThread.prototype.isDead = function () {
        return this._frameStack.length < 1;
    };

    RegexVmThread.prototype.branch = function () {
        var offset = this.readInteger(true, 2);

        this._pc += offset;
    };

    /**
     *  @returns {RegexVmFrame}
     */
    RegexVmThread.prototype.getCurrentFrame = function () {
        if(this.isDead()) {
            throw new Error("The thread has been already dead.");
        }

        return this._frameStack[this._frameStack.length - 1];
    };

    /**
     *  @function
     */
    RegexVmThread.prototype.jumpToSubroutine = function () {
        var addr = this.readInteger(false, 4);

        this._frameStack.push(new RegexVmFrame(this._pc));
        this._pc = addr;
    };

    /**
     *  @function
     */
    RegexVmThread.prototype.returnFromSubroutine = function () {
        this._pc = this.getCurrentFrame()._returnAddress;
        this._frameStack.pop();
    };

    /**
     *  @function
     *  @param {boolean} prioritize
     */
    RegexVmThread.prototype.fork = function (prioritize) {
        var goToOffset = this.readInteger(true, 2);
        var newThreadPcOffset = this.readInteger(true, 2);

        var forkPc = this._instAddr;
        for(var i = this._path.length; i > 0; ) {
            --i;

            var point = this._path[i];
            if(point[2] > 0) {
                break;
            }

            if(point[0] === forkPc) {
                this._frameStack.length = 0;
                return;
            }
        }

        this._vm.createThread(
            this._pc + newThreadPcOffset,
            this,
            prioritize
        );

        this._pc += goToOffset;
    };

    /**
     *  @function
     */
    RegexVmThread.prototype.accept = function () {
        var tokenKey = this.readInteger(false, 4);

        this._matchResult = new MatchResult(
            tokenKey,
            "",
            null
        );

        var cursorStart = this._consumeRanges[0];
        var start = cursorStart;
        for(var i = 1; i < this._consumeRanges.length; ++i) {
            var end = this._consumeRanges[i];
            if(RegexVmThread._skipDelimiter === end) {
                ++i;
                if(i >= this._consumeRanges.length) {
                    break;
                }

                start = this._consumeRanges[i];
            }
            else {
                this._matchResult.text += this._vm._inStr.substring(start, end);

                start = end;
            }
        }

        this._matchResult.range = new Interval(
            cursorStart,
            this._vm._cursor
        );

        this._frameStack.length = 0;
    };

    /**
     *  @function
     *  @param {boolean} consume
     */
    RegexVmThread.prototype.moveConsumePointer = function (consume) {
        if(!consume) {
            this._consumeRanges.push(RegexVmThread._skipDelimiter);
        }
        this._consumeRanges.push(this._vm._cursor);
    };

    /**
     *  @function
     */
    RegexVmThread.prototype.beginGroup = function () {
        var groupIndex = this.readInteger(false, 1);

        this._groupNdxStack.push(groupIndex);
        this._consumedValues.push([2, groupIndex]);
    };

    /**
     *  @function
     */
    RegexVmThread.prototype.endGroup = function () {
        var groupIndex = this.readInteger(false, 1);

        this._groupNdxStack.pop();
        this._consumedValues.push([3, groupIndex]);
    };

    /**
     *  @function
     */
    RegexVmThread.prototype.testCode = function () {
        var charCode = this.readInteger(false, 4);

        if(!this._vm.inputMatchesCode(charCode)) {
            this._frameStack.length = 0;
        }
        else {
            if(this._path.length > 0) {
                ++this._path[this._path.length - 1][2];
            }

            this._consumedValues.push([0, this._vm.getCurrentCharacterCode()]);
        }
    };

    /**
     *  @function
     */
    RegexVmThread.prototype.testRange = function () {
        var rangeIndex = this.readInteger(false, 4);

        if(!this._vm.inputIsInRange(rangeIndex)) {
            this._frameStack.length = 0;
        }
        else {
            if(this._path.length > 0) {
                ++this._path[this._path.length - 1][2];
            }

            this._consumedValues.push([0, this._vm.getCurrentCharacterCode()]);
        }
    };

    /**
     *  @function
     */
    RegexVmThread.prototype.testRanges = function () {
        var rangeSetIndex = this.readInteger(false, 4);

        if(!this._vm.inputIsInRangeSet(rangeSetIndex)) {
            this._frameStack.length = 0;
        }
        else {
            if(this._path.length > 0) {
                ++this._path[this._path.length - 1][2];
            }

            this._consumedValues.push([0, this._vm.getCurrentCharacterCode()]);
        }
    };

    /**
     *  @constructor
     *  @param {RegexVmFrame|Number} arg0
     */
    function RegexVmFrame(arg0)
    {
        if(arg0 instanceof RegexVmFrame) {
            this._returnAddress = arg0._returnAddress;
            this._repStack = utils._copyIntArray(arg0._repStack);
        }
        else if(isNonNegativeSafeInteger(arg0)) {
            this._returnAddress = arg0;
            this._repStack = [];
        }
        else {
            throw new TypeError("An invalid argument.");
        }
    }

    /**
     *  @constructor
     *  @param {Iterable<Interval>} rangeSet
     *  @param {Iterable<any>} rangeIndexSets
     *  @param {boolean} littleEndian
     *  @param {karbonator.ByteArray} codeBlock
     *  @param {string} [sourceCodeForDebug]
     */
    function RegexVmBytecode(
        rangeSet, rangeIndexSets,
        littleEndian, codeBlock
    )
    {
        if(!isIterable(rangeSet)) {
            throw new TypeError("The parameter 'ranges' must have the property 'Symbol.iterator'.");
        }
        if(!isIterable(rangeIndexSets)) {
            throw new TypeError("The parameter 'rangeIndexSets' must have the property 'Symbol.iterator'.");
        }
        if(!(codeBlock instanceof ByteArray)) {
            throw new TypeError("The parameter 'codeBlock' must be an instance of 'karbonator.ByteArray'.");
        }

        this._ranges = Array.from(rangeSet);
        this._rangeIndexSets = Array.from(rangeIndexSets);
        this._littleEndian = !!littleEndian;
        this._codeBlock = ByteArray.from(codeBlock);
        this._sourceCodeForDebug = arguments[4];
        if(isUndefined(this._sourceCodeForDebug)) {
            this._sourceCodeForDebug = "";
        }
    }

    /**
     *  @function
     *  @param {number} addr
     *  @param {boolean} signed
     *  @param {number} byteCount
     *  @returns {number}
     */
    RegexVmBytecode.prototype.readInteger = function (addr, signed, byteCount) {
        return bytesToInteger(
            this._codeBlock,
            byteCount, signed,
            this._littleEndian,
            addr
        );
    };

    return {
        RegexVmInstruction : RegexVmInstruction,
        RegexVmBytecode : RegexVmBytecode,
        RegexVm : RegexVm
    };
})();
