var isUndefined = require("kaphein-js").isUndefined;
var isUndefinedOrNull = require("kaphein-js").isUndefinedOrNull;
var isNumber = require("kaphein-js").isNumber;
var isString = require("kaphein-js").isString;
var isCallable = require("kaphein-js").isCallable;
var isIterable = require("kaphein-js").isIterable;
var RbTreeMap = require("kaphein-js").RbTreeMap;
var ArraySet = require("kaphein-js").ArraySet;
var ArrayMap = require("kaphein-js").ArrayMap;
var relativelyEquals = require("kaphein-js").relativelyEquals;
var Interval = require("kaphein-js-math").Interval;

var integerComparator = require("./utils").integerComparator;
var isNonNegativeSafeInteger = require("./utils").isNonNegativeSafeInteger;
var assertion = require("./utils").assertion;
var _areEqual = require("./utils")._areEqual;
var _copyIntArray = require("./utils")._copyIntArray;
var _selectNonUndefined = require("./utils")._selectNonUndefined;
var Enum = require("./my-enum").MyEnum;
var ByteArray = require("./byte-array").ByteArray;
var RegexVmInstruction = require("./regex-vm").RegexVmInstruction;
var RegexVmBytecode = require("./regex-vm").RegexVmBytecode;
var RegexVm = require("./regex-vm").RegexVm;

module.exports = (function ()
{
    var _minInt = Number.MIN_SAFE_INTEGER;
    var _maxInt = Number.MAX_SAFE_INTEGER;
    var _charCodeMin = 0x000000;
    var _charCodeMax = 0x10FFFF;
    var _epsilon = 1e-6;

    /**
     *  @param {Interval} l
     *  @param {Interval} r
     */
    function _edgeEqualComparator(l, r)
    {
        return l.equals(r);
    }

    /*////////////////////////////////*/
    //AstNode

    /**
     *  @constructor
     *  @param {number} type
     *  @param {Object} value
     *  @param {boolean} [rootOfGroup=false]
     */
    function AstNode(type, value)
    {
        assertion.isTrue(isNonNegativeSafeInteger(type));
        assertion.isTrue(!isUndefined(value));

        this._type = type;
        this._value = value;
        this._rootOfGroup = !!arguments[2];
        this._parent = null;
        this._children = [];
    }

    /**
     *  @param {*} o
     */
    AstNode._assertIsAstNode = function (o)
    {
        if(!(o instanceof AstNode))
        {
            throw new TypeError("The parameter must be an instance of AstNode.");
        }
    };

    /**
     *  @constructor
     *  @param {AstNode} rootNode
     *  @param {AstNode} currentNode
     */
    AstNode.CppPrefixIterator = function (rootNode, currentNode)
    {
        this._rootNode = rootNode;
        this._currentNode = currentNode;
    };

    /**
     *  @function
     *  @returns {boolean}
     */
    AstNode.CppPrefixIterator.prototype.moveToNext = function ()
    {
        if(null !== this._currentNode)
        {
            if(this._currentNode.isLeaf())
            {
                while(null !== this._currentNode)
                {
                    var nextSibling = this._currentNode.getNextSibling();
                    if(null !== nextSibling)
                    {
                        this._currentNode = nextSibling;
                        break;
                    }

                    this._currentNode = this._currentNode.getParent();
                }
            }
            else
            {
                this._currentNode = (
                    this._currentNode.getChildCount() > 0
                        ? this._currentNode.getChildAt(0)
                        : null
                );
            }
        }

        return null !== this._currentNode;
    };

    /**
     *  @function
     *  @returns {AstNode}
     */
    AstNode.CppPrefixIterator.prototype.dereference = function ()
    {
        assertion.isTrue(null !== this._currentNode);

        return this._currentNode;
    };

    /**
     *  @function
     *  @param {AstNode.CppPrefixIterator} rhs
     *  @returns {boolean}
     */
    AstNode.CppPrefixIterator.prototype.equals = function (rhs)
    {
        if(this === rhs)
        {
            return true;
        }

        if(isUndefinedOrNull(rhs))
        {
            return false;
        }

        return this._rootNode === rhs._rootNode
            && this._currentNode === rhs._currentNode
        ;
    };

    /**
     *  @constructor
     *  @param {AstNode} rootNode
     *  @param {AstNode} currentNode
     */
    AstNode.CppPostfixIterator = function (rootNode, currentNode)
    {
        this._rootNode = rootNode;
        this._currentNode = currentNode;
    };

    /**
     *  @function
     *  @returns {boolean}
     */
    AstNode.CppPostfixIterator.prototype.moveToNext = function ()
    {
        do
        {
            var nextSibling = this._currentNode.getNextSibling();
            if(null === nextSibling)
            {
                this._currentNode = this._currentNode.getParent();
                if(null === this._currentNode)
                {
                    break;
                }
            }
            else
            {
                this._currentNode = nextSibling.getLeftmostLeaf();
            }
        }
        while(null === this._currentNode);
    };

    /**
     *  @function
     *  @returns {AstNode}
     */
    AstNode.CppPostfixIterator.prototype.dereference = function ()
    {
        assertion.isTrue(null !== this._currentNode);

        return this._currentNode;
    };

    /**
     *  @function
     *  @param {AstNode.CppPostfixIterator} rhs
     *  @returns {boolean}
     */
    AstNode.CppPostfixIterator.prototype.equals = function (rhs)
    {
        if(this === rhs)
        {
            return true;
        }

        if(isUndefinedOrNull(rhs))
        {
            return false;
        }

        return this._rootNode === rhs._rootNode
            && this._currentNode === rhs._currentNode
        ;
    };

    // /**
    //  *  @function
    //  *  @returns {AstNode}
    //  */
    // AstNode.prototype[karbonator.shallowClone] = function () {
    //     return new AstNode(
    //         this._type,
    //         karbonator.shallowCloneObject(this._value),
    //         this._rootOfGroup
    //     );
    // };

    /**
     *  @function
     *  @returns {boolean}
     */
    AstNode.prototype.isRootOfGroup = function ()
    {
        return this._rootOfGroup;
    };

    /**
     *  @function
     *  @param {boolean} flag
     */
    AstNode.prototype.setRootOfGroup = function (flag)
    {
        this._rootOfGroup = !!flag;
    };

    /**
     *  @function
     *  @returns {number}
     */
    AstNode.prototype.getType = function ()
    {
        return this._type;
    };

    /**
     *  @function
     *  @returns {Object}
     */
    AstNode.prototype.getValue = function ()
    {
        return this._value;
    };

    /**
     *  @function
     *  @returns {boolean}
     */
    AstNode.prototype.isLeaf = function ()
    {
        return this._children.length < 1;
    };

    /**
     *  @function
     *  @returns {AstNode|null}
     */
    AstNode.prototype.getRoot = function ()
    {
        var current = this._parent;
        if(null === current)
        {
            return this;
        }

        var previous = null;
        while(null !== current)
        {
            previous = current;
            current = current._parent;
        }

        return previous;
    };

    /**
     *  @function
     *  @returns {AstNode|null}
     */
    AstNode.prototype.getParent = function ()
    {
        return this._parent;
    };

    /**
     *  @function
     *  @returns {number}
     */
    AstNode.prototype.getChildIndex = function ()
    {
        var index = -1;
        if(null !== this._parent)
        {
            index = this._parent._children.indexOf(this);
        }

        return index;
    };

    /**
     *  @function
     *  @returns {AstNode|null}
     */
    AstNode.prototype.getNextSibling = function ()
    {
        var nextSibling = null;
        if(null !== this._parent)
        {
            var childIndex = this.getChildIndex() + 1;
            if(childIndex < this._parent.getChildCount())
            {
                nextSibling = this._parent.getChildAt(childIndex);
            }
        }

        return nextSibling;
    };

    /**
     *  @function
     *  @returns {number}
     */
    AstNode.prototype.getChildCount = function ()
    {
        return this._children.length;
    };

    /**
     *  @function
     *  @param {number} index
     *  @returns {AstNode}
     */
    AstNode.prototype.getChildAt = function (index)
    {
        assertion.isTrue(isNonNegativeSafeInteger(index));

        if(index >= this._children.length)
        {
            throw new Error("Index out of range.");
        }

        return this._children[index];
    };

    /**
     *  @function
     *  @returns {AstNode}
     */
    AstNode.prototype.getLastChild = function ()
    {
        if(this.isLeaf())
        {
            throw new Error("The node has no children.");
        }

        return this._children[this._children.length - 1];
    };

    /**
     *  @function
     *  @returns {AstNode}
     */
    AstNode.prototype.getLeftmostLeaf = function ()
    {
        var current = this;
        while(!current.isLeaf())
        {
            current = current._children[0];
        }

        return current;
    };

    /**
     *  @function
     *  @param {AstNode} child
     */
    AstNode.prototype.addChild = function (child)
    {
        AstNode._assertIsAstNode(child);

        if(this === child)
        {
            throw new Error("'this' node cannot be of a child of 'this'.");
        }

        if(this._children.includes(child))
        {
            throw new Error("The node already has the 'child' node.");
        }

        if(null !== child.getParent())
        {
            child.getParent().removeChild(child);
        }
        this._children.push(child);
        child._parent = this;
    };

    /**
     *  @function
     *  @param {iterable} nodes
     *  @param {number} index
     */
    AstNode.prototype.insertChildren = function (nodes, index)
    {
        assertion.isTrue(isIterable(nodes));
        assertion.isTrue(isNonNegativeSafeInteger(index));

        if(index > this._children.length)
        {
            throw new Error("Index out of range.");
        }

        for(
            var iter = nodes[Symbol.iterator](), iterPair = iter.next();
            !iterPair.done;
            iterPair = iter.next(), ++index
        )
        {
            var child = iterPair.value;
            AstNode._assertIsAstNode(child);

            if(null !== child.getParent())
            {
                child.getParent().removeChild(child);
            }

            this._children.splice(index, 0, child);
            child._parent = this;
        }
    };

    /**
     *  @function
     *  @param {AstNode} child
     *  @returns {number}
     */
    AstNode.prototype.removeChild = function (child)
    {
        assertion.isInstanceOf(child, AstNode);

        var index = this._children.indexOf(child);
        if(index >= 0)
        {
            this.removeChildAt(index);
        }

        return index;
    };

    /**
     *  @function
     *  @param {number} index
     *  @returns {AstNode}
     */
    AstNode.prototype.removeChildAt = function (index)
    {
        assertion.isTrue(isNonNegativeSafeInteger(index));

        if(index > this._children.length)
        {
            throw new Error("Index out of range.");
        }

        var removedChild = this._children.splice(index, 1)[0];
        assertion.isTrue(this === removedChild._parent);
        removedChild._parent = null;

        return removedChild;
    };

    /**
     *  @function
     *  @returns {Array.<AstNode>}
     */
    AstNode.prototype.removeAllChildren = function ()
    {
        var removedChildren = this._children.slice();
        for(var i = 0, count = removedChildren.lenght; i < count; ++i)
        {
            assertion.isTrue(this === removedChildren._parent);
            removedChildren[i]._parent = null;
        }
        this._children.length = 0;

        return removedChildren;
    };

    /**
     *  @function
     *  @returns {AstNode.CppPrefixIterator}
     */
    AstNode.prototype.beginPrefix = function ()
    {
        return new AstNode.CppPrefixIterator(this.getRoot(), this);
    };

    /**
     *  @function
     *  @returns {AstNode.CppPrefixIterator}
     */
    AstNode.prototype.endPrefix = function ()
    {
        return new AstNode.CppPrefixIterator(this.getRoot(), null);
    };

    /**
     *  @function
     *  @param {Function} callback
     *  @param {Object} [thisArg]
     *  @param {boolean}
     */
    AstNode.prototype.traverseByPrefix = function (callback)
    {
        if(!isCallable(callback))
        {
            throw new TypeError("The callback must be a callable object.");
        }

        var thisArg = arguments[1];

        var nodeStack = [this];

        var continueTraversal = true;
        while(continueTraversal && nodeStack.length > 0)
        {
            var currentNode = nodeStack.pop();
            continueTraversal = !callback.call(thisArg, currentNode);

            if(continueTraversal)
            {
                for(var i = currentNode._children.length; i > 0; )
                {
                    --i;
                    nodeStack.push(currentNode._children[i]);
                }
            }
        }

        return continueTraversal;
    };

    /**
     *  @function
     *  @returns {AstNode.CppPostfixIterator}
     */
    AstNode.prototype.beginPostfix = function ()
    {
        return new AstNode.CppPostfixIterator(this.getRoot(), this.getLeftmostLeaf());
    };

    /**
     *  @function
     *  @returns {AstNode.CppPostfixIterator}
     */
    AstNode.prototype.endPostfix = function ()
    {
        return new AstNode.CppPostfixIterator(this.getRoot(), null);
    };

    /**
     *  @function
     *  @param {Function} callback
     *  @param {Object} [thisArg]
     *  @param {boolean}
     */
    AstNode.prototype.traverseByPostfix = function (callback)
    {
        if(!isCallable(callback))
        {
            throw new TypeError("The callback must be a callable object.");
        }

        var thisArg = arguments[1];

        var nodeStack = [this];

        var continueTraversal = true;
        for(
            var lastTraversedNode = null;
            continueTraversal && nodeStack.length > 0;
        )
        {
            var currentNode = nodeStack[nodeStack.length - 1];
            if(
                !currentNode.isLeaf()
                && currentNode.getLastChild() !== lastTraversedNode
            )
            {
                for(var i = currentNode._children.length; i > 0; )
                {
                    --i;
                    nodeStack.push(currentNode._children[i]);
                }
            }
            else
            {
                continueTraversal = !callback.call(thisArg, currentNode);
                lastTraversedNode = currentNode;
                nodeStack.pop();
            }
        }

        return continueTraversal;
    };

    /**
     *  @function
     *  @param {AstNode} rhs
     *  @returns {boolean}
     */
    AstNode.prototype.equals = function (rhs)
    {
        if(this === rhs)
        {
            return true;
        }

        if(isUndefinedOrNull(rhs))
        {
            return false;
        }

        if(
            this._type !== rhs._type
            || this._rootOfGroup !== rhs._rootOfGroup
        )
        {
            return false;
        }

        return _areEqual(this._value, rhs._value);
    };

    /**
     *  @function
     *  @param {AstNode} otherRoot
     *  @returns {boolean}
     */
    AstNode.prototype.subtreeEquals = function (otherRoot)
    {
        AstNode._assertIsAstNode(otherRoot);

        var lhsIter = this.beginPrefix();
        var lhsEndIter = this.endPrefix();
        var rhsIter = otherRoot.beginPrefix();
        var rhsEndIter = otherRoot.endPrefix();
        var result = false;

        for(var loop = true; loop; )
        {
            var lhsHasNext = !lhsIter.equals(lhsEndIter);
            var rhsHasNext = !rhsIter.equals(rhsEndIter);
            if(lhsHasNext !== rhsHasNext)
            {
                loop = false;
            }
            else if(lhsHasNext)
            {
                if(!lhsIter.dereference().equals(rhsIter.dereference()))
                {
                    loop = false;
                }
                else
                {
                    lhsIter.moveToNext();
                    rhsIter.moveToNext();
                }
            }
            else
            {
                result = true;
                loop = false;
            }
        }

        return result;
    };

    /**
     *  @function
     *  @returns {string}
     */
    AstNode.prototype.toString = function ()
    {
        var context = {
            str : "",
            toStringFunc : AstNode._astNodeToString
        };

        for(
            var iter = this.beginPostfix(), endIter = this.endPostfix();
            !iter.equals(endIter);
            iter.moveToNext()
        )
        {
            context.str += context.toStringFunc(iter.dereference());
            context.str += "\r\n";
        }

        return context.str;
    };

    /**
     *  @param {AstNode} thisRef
     */
    AstNode._astNodeToString = function (thisRef)
    {
        var str = "{";

        str += "rootOfGroup";
        str += " : ";
        str += thisRef._rootOfGroup;

        str += ", ";
        str += "type";
        str += " : ";
        str += thisRef._type;

        str += ", ";
        str += "value";
        str += " : ";
        str += thisRef._value;

        str += ", ";
        str += "childCount";
        str += " : ";
        str += thisRef._children.length;

        str += "}";

        return str;
    };

    /*////////////////////////////////*/

    /*////////////////////////////////*/
    //Scanner interface...?

    /**
     *  @constructor
     *  @param {number} [code=0]
     *  @param {string} [message=""]
     */
    function ScannerError()
    {
        this.code = arguments[0];
        if(isUndefinedOrNull(this.code))
        {
            this.code = 0;
        }

        this.message = arguments[1];
        if(isUndefinedOrNull(this.message))
        {
            this.message = "";
        }
    }

    /**
     *  @constructor
     *  @param {number} valueType
     *  @param {Array.<Number>} value
     *  @param {Interval} range
     *  @param {ScannerError} [error]
     */
    function ScannerResult(valueType, value, range)
    {
        this.valueType = valueType;
        this.value = value;
        this.range = range;

        this.error = arguments[3];
        if(isUndefinedOrNull(this.error))
        {
            this.error = new ScannerError();
        }
    }

    /*////////////////////////////////*/

    /*////////////////////////////////*/
    //OperatorType

    /**
     *  @constructor
     *  @param {number} key
     *  @param {string} name
     *  @param {number} parameterCount
     *  @param {number} priority
     *  @param {number} associativity
     */
    function OperatorType(key, name, parameterCount, priority, associativity)
    {
        if(!isNonNegativeSafeInteger(key))
        {
            throw new TypeError("'key' must be a non negative safe integer.");
        }
        if(!isString(name))
        {
            throw new TypeError("'name' must be a strin.");
        }
        if(!isNonNegativeSafeInteger(parameterCount))
        {
            throw new TypeError("'parameterCount' must be a non negative safe integer.");
        }
        if(!isNonNegativeSafeInteger(priority))
        {
            throw new TypeError("'priority' must be a non negative safe integer.");
        }
        if(!isNonNegativeSafeInteger(associativity))
        {
            throw new TypeError("'associativity' must be a non negative safe integer.");
        }

        this._key = key;
        this._name = name;
        this._parameterCount = parameterCount;
        this._priority = priority;
        this._associativity = associativity;
    }

    /**
     *  @readonly
     *  @enum {number}
     */
    OperatorType.Associativity = {
        none : 0,
        leftToRight : 1,
        rightToLeft : 2
    };

    OperatorType.valueOf = function get(key)
    {
        return _opTypeMap.get(key);
    };

    /**
     *  @function
     *  @returns {number}
     */
    OperatorType.prototype.getKey = function ()
    {
        return this._key;
    };

    /**
     *  @function
     *  @returns {string}
     */
    OperatorType.prototype.getName = function ()
    {
        return this._name;
    };

    /**
     *  @function
     *  @returns {number}
     */
    OperatorType.prototype.getParameterCount = function ()
    {
        return this._parameterCount;
    };

    /**
     *  @function
     *  @param {OperatorType} rhs
     *  @returns {boolean}
     */
    OperatorType.prototype.precedes = function (rhs)
    {
        return rhs._priority < this._priority;
    };

    /**
     *  @function
     *  @returns {number}
     */
    OperatorType.prototype.getAssociativity = function ()
    {
        return this._associativity;
    };

    /**
     *  @function
     *  @param {OperatorType} rhs
     *  @returns {boolean}
     */
    OperatorType.prototype.equals = function (rhs)
    {
        if(this === rhs)
        {
            return true;
        }

        if(isUndefinedOrNull(rhs))
        {
            return false;
        }

        var result = this._key === rhs._key;
        if(result)
        {
            if(
                this._name !== rhs._name
                || this._parameterCount !== rhs._parameterCount
                || this._priority !== rhs._priority
                || this._associativity !== rhs._associativity
                || this._action !== rhs._action
            )
            {
                throw new Error("Operators that have the same key must have same properties and values.");
            }
        }

        return result;
    };

    /**
     *  @function
     *  @returns {string}
     */
    OperatorType.prototype.toString = function ()
    {
        var str = "{";

        str += "name";
        str += " : ";
        str += this._name;

        str += ", ";
        str += "parameterCount";
        str += " : ";
        str += this._parameterCount;

        str += ", ";
        str += "priority";
        str += " : ";
        str += this._priority;

        str += "}";

        return str;
    };

    /*////////////////////////////////*/

    /*////////////////////////////////*/
    //Operator

    /**
     *  @constructor
     *  @param {OperatorType} type
     *  @param {Array.<Object>} [staticArgs]
     */
    function Operator(type)
    {
        assertion.isTrue(!isNonNegativeSafeInteger(type));

        this._type = type;
        this._staticArgs = (
            isUndefined(arguments[1])
                ? []
                : Array.from(arguments[1])
        );
    }

    // /**
    //  *  @function
    //  *  @returns {Operator}
    //  */
    // Operator.prototype[karbonator.shallowClone] = function () {
    //     return new Operator(
    //         this._type,
    //         karbonator.shallowCloneObject(this._staticArgs)
    //     );
    // };

    /**
     *  @function
     *  @returns {OperatorType}
     */
    Operator.prototype.getType = function ()
    {
        return this._type;
    };

    /**
     *  @function
     *  @returns {number}
     */
    Operator.prototype.getStaticArgumentCount = function ()
    {
        return this._staticArgs.length;
    };

    /**
     *  @function
     *  @returns {Array.<Object>}
     */
    Operator.prototype.getStaticArguments = function ()
    {
        return this._staticArgs;
    };

    /**
     *  @function
     *  @param {Operator} rhs
     *  @returns {boolean}
     */
    Operator.prototype.equals = function (rhs)
    {
        if(this === rhs)
        {
            return true;
        }

        if(isUndefinedOrNull(rhs))
        {
            return false;
        }

        return this._type === rhs._type
            && _areEqual(this._staticArgs, rhs._staticArgs)
        ;
    };

    /**
     *  @function
     *  @returns {string}
     */
    Operator.prototype.toString = function ()
    {
        var str = "{";

        str += "type";
        str += " : ";
        str += this._type;

        str += ", ";
        str += "staticArgs";
        str += " : ";
        str += "[";
        str += this._staticArgs;
        str += "]";

        str += "}";

        return str;
    };

    /*////////////////////////////////*/

    /*////////////////////////////////*/
    //RegexParser

    /**
     *  @readonly
     *  @enum {number}
     */
    var OperatorTypeKeys = {
        regexAlternation : 0,
        accept : 1,
        tokenExpressionCall : 2,
        alternation : 3,
        concatenation : 4,
        repetition : 5
    };

    /**
     *  @readonly
     *  @type {Map.<Number, Operator>}
     */
    var _opTypeMap = new RbTreeMap(
        Array.from(
            [
                new OperatorType(
                    OperatorTypeKeys.regexAlternation,
                    "regexAlternation",
                    2, 1,
                    OperatorType.Associativity.leftToRight
                ),
                new OperatorType(
                    OperatorTypeKeys.accept,
                    "accept",
                    0, 20,
                    OperatorType.Associativity.leftToRight
                ),
                new OperatorType(
                    OperatorTypeKeys.tokenExpressionCall,
                    "tokenExpressionCall",
                    0, 10,
                    OperatorType.Associativity.leftToRight
                ),
                new OperatorType(
                    OperatorTypeKeys.alternation,
                    "alternation",
                    2, 1,
                    OperatorType.Associativity.leftToRight
                ),
                new OperatorType(
                    OperatorTypeKeys.concatenation,
                    "concatenation",
                    2, 2,
                    OperatorType.Associativity.leftToRight
                ),
                new OperatorType(
                    OperatorTypeKeys.repetition,
                    "repetition",
                    1, 3,
                    OperatorType.Associativity.leftToRight
                )
            ],
            /**
             *  @function
             *  @param {OperatorType} current
             *  @returns {Array}
             */
            function (current)
            {
                return [current.getKey(), current];
            }
        ),
        integerComparator
    );

    /**
     *  @constructor
     */
    function RegexParser()
    {
        this._regexStr = "";
        this._state = 0;
        this._pos = 0;
        this._parsing = false;
        this._exprCtxStack = [];
        this._error = {
            occured : false,
            message : "",
            position : 0
        };

        this._edgeSet = new ArraySet(null, _edgeEqualComparator);
    }

    /**
     *  @readonly
     *  @enum {number}
     */
    RegexParser.AstNodeType = {
        operator : 0,
        terminal : 1
    };

    /**
     *  @private
     *  @enum {Object}
     */
    RegexParser._CharRange = Enum.create(
        /**
         *  @param {karbonator.util.Enum} proto
         */
        function (proto)
        {
            proto.getRange = function ()
            {
                return this._range;
            };
        },
        function (min)
        {
            var max = arguments[1];
            if(isUndefined(max))
            {
                max = min;
            }

            this._range = new Interval(min, max);
        },
        [
            ["anyChars", [_charCodeMin, _charCodeMax]],
            ["docCtrlCodes", [0x09, 0x0D]],
            ["posixLower", [0x61, 0x7A]],
            ["posixUpper", [0x41, 0x5A]],
            ["posixDigit", [0x30, 0x39]],
            ["posixGraph", [0x21, 0x7E]],
            ["horizontalTab", [0x09]],
            ["lineFeed", [0x0A]],
            ["verticalTab", [0x0B]],
            ["formFeed", [0x0C]],
            ["carrigeReturn", [0x0D]],
            ["space", [0x20]],
            ["underscore", [0x5F]],
            ["del", [0x7F]]
        ]
    );

    /**
     *  @private
     *  @enum {Object}
     */
    RegexParser._CharRangeSet = Enum.create(
        /**
         *  @param {karbonator.util.Enum} proto
         *  @param {Function} ctor
         */
        function (proto, ctor)
        {
            proto._ctor = ctor;

            proto.getRanges = function ()
            {
                return this._ranges;
            };
        },
        function ()
        {
            this._ranges = [];

            for(var i = 0; i < arguments.length; ++i)
            {
                var arg = arguments[i];
                if(isString(arg))
                {
                    this._ranges = this._ranges.concat((
                        arg[0] === "!"
                            ? Interval.negate(
                                this._ctor[arg.substring(1)].getRanges(),
                                _minInt,
                                _maxInt
                            )
                            : this._ctor[arg].getRanges()
                    ));
                }
                else
                {
                    if(!(arg instanceof Interval))
                    {
                        throw new TypeError("");
                    }

                    this._ranges.push(arg);
                }
            }
        },
        [
            ["lower", [new Interval(0x61, 0x7A)]],
            ["upper", [new Interval(0x41, 0x5A)]],
            ["digit", [new Interval(0x30, 0x39)]],
            ["graph", [new Interval(0x21, 0x7E)]],
            [
                "print",
                [
                    RegexParser._CharRange.space.getRange(),
                    RegexParser._CharRange.posixGraph.getRange()
                ]
            ],
            [
                "alpha",
                [
                    RegexParser._CharRange.posixLower.getRange(),
                    RegexParser._CharRange.posixUpper.getRange()
                ]
            ],
            [
                "alnum",
                [
                    "alpha",
                    RegexParser._CharRange.posixDigit.getRange()
                ]
            ],
            [
                "blank",
                [
                    RegexParser._CharRange.space.getRange(),
                    RegexParser._CharRange.horizontalTab.getRange()
                ]
            ],
            [
                "space",
                [
                    RegexParser._CharRange.space.getRange(),
                    RegexParser._CharRange.docCtrlCodes.getRange()
                ]
            ],
            [
                "xdigit",
                [
                    RegexParser._CharRange.posixDigit.getRange(),
                    new Interval(0x41, 0x46),
                    new Interval(0x61, 0x66)
                ]
            ],
            [
                "cntrl",
                [
                    RegexParser._CharRange.del.getRange(),
                    new Interval(0x00, 0x1F)
                ]
            ],
            [
                "nonWhiteSpaces",
                [
                    "!space"
                ]
            ],
            [
                "word",
                [
                    "alnum",
                    RegexParser._CharRange.underscore.getRange()
                ]
            ],
            [
                "nonWord",
                [
                    "!word"
                ]
            ]
        ]
    );

    /**
     *  @param {string} str
     *  @param {number} [startIndex=0]
     *  @returns {ScannerResult}
     */
    RegexParser._scanInteger = function (str)
    {
        var startIndex = arguments[1];
        if(isUndefined(startIndex))
        {
            startIndex = 0;
        }
        else if(!isNonNegativeSafeInteger(startIndex))
        {
            throw new RangeError("'startIndex' must be an non-negative safe integer.");
        }

        var pos = startIndex;

        var errorCode = 0;
        var errorMessage = "";

        var valueType = 0;
        var value = [];
        var valid = true;

        var state = 0;
        while(
            state < 2
            && pos < str.length
            && errorCode === 0
        )
        {
            var ch = str.charAt(pos);

            switch(state)
            {
            case 0:
                switch(ch)
                {
                case "1": case "2": case "3": case "4":
                case "5": case "6": case "7": case "8": case "9":
                    value.push(ch.charCodeAt(0));

                    ++pos;
                    ++state;
                    break;
                case "0":
                case "A": case "B": case "C": case "D": case "E": case "F":
                case "a": case "b": case "c": case "d": case "e": case "f":
                    valueType = 1;
                    value.push(ch.charCodeAt(0));

                    ++pos;
                    ++state;
                    break;
                default:
                    state = 2;
                }
                break;
            case 1:
                switch(ch)
                {
                case "0": case "1": case "2": case "3": case "4":
                case "5": case "6": case "7": case "8": case "9":
                    value.push(ch.charCodeAt(0));

                    ++pos;
                    break;
                case "A": case "B": case "C": case "D": case "E": case "F":
                case "a": case "b": case "c": case "d": case "e": case "f":
                    valueType = 1;
                    value.push(ch.charCodeAt(0));

                    ++pos;
                    break;
                default:
                    state = 2;
                }
                break;
            }
        }

        if(errorCode === 0 && !valid)
        {
            errorCode = 2;
            errorMessage = "";
        }

        return new ScannerResult(
            valueType, value,
            new Interval(startIndex, pos),
            new ScannerError(errorCode, errorMessage)
        );
    };

    /**
     * Value types.
     * 0 : charCode
     * 1 : charRangeIndex
     * 2 : charRangeSetIndex
     * 3 : backRefIndex
     * 
     *  @param {string} str
     *  @param {number} [startIndex=0]
     *  @returns {ScannerResult}
     */
    RegexParser._scanEscapedCharacter = function (str)
    {
        var startIndex = arguments[1];
        if(isUndefined(startIndex))
        {
            startIndex = 0;
        }
        else if(!isNonNegativeSafeInteger(startIndex))
        {
            throw new RangeError("'startIndex' must be an non-negative safe integer.");
        }

        var pos = _selectNonUndefined(arguments[1], 0);

        var errorCode = 0;
        var errorMessage = "";

        var scanResult = null;

        var valueType = 0;
        var value = [];
        var valid = false;

        var state = 0;
        while(
            state < 10
            && errorCode === 0
            && pos < str.length
        )
        {
            var ch = str.charAt(pos);

            switch(state)
            {
            case 0:
                if(ch !== "\\")
                {
                    errorCode = 1;
                    errorMessage = "An escaped character must start with '\\'.";
                }
                else
                {
                    ++pos;
                    ++state;
                }
                break;
            case 1:
                switch(ch)
                {
                case "s":
                    valueType = 2;
                    value.push(
                        RegexParser._CharRangeSet.space[
                            Enum.getIndex
                        ]()
                    );

                    ++pos;
                    valid = true;
                    state = 10;
                    break;
                case "S":
                    valueType = 2;
                    value.push(
                        RegexParser._CharRangeSet.nonWhiteSpaces[
                            Enum.getIndex
                        ]()
                    );

                    ++pos;
                    valid = true;
                    state = 10;
                    break;
                case "w":
                    valueType = 2;
                    value.push(
                        RegexParser._CharRangeSet.word[
                            Enum.getIndex
                        ]()
                    );

                    ++pos;
                    valid = true;
                    state = 10;
                    break;
                case "W":
                    valueType = 2;
                    value.push(
                        RegexParser._CharRangeSet.nonWord[
                            Enum.getIndex
                        ]()
                    );

                    ++pos;
                    valid = true;
                    state = 10;
                    break;
                case "0": case "1": case "2": case "3": case "4":
                case "5": case "6": case "7": case "8": case "9":
                    scanResult = RegexParser._scanInteger(str, pos);
                    if(scanResult.error.code !== 0)
                    {
                        errorCode = scanResult.error.code + 10;
                        errorMessage = scanResult.error.message;
                    }
                    else
                    {
                        valueType = 3;
                        var index = Number.parseInt(
                            charCodesToString(scanResult.value),
                            (scanResult.valueType === 0 ? 10 : 16)
                        );
                        value.push(index);
                        pos = scanResult.range.getMaximum();
                        valid = true;
                        state = 10;
                    }
                    break;
                case "d":
                    ++pos;
                    state = 2;
                    break;
                case "x":
                    ++pos;
                    state = 3;
                    break;
                case "u":
                    valueType = 0;
                    errorCode = 5;
                    errorMessage = "Unicode code point is not implemented yet...";
                    break;
                case "p":
                    valueType = 2;
                    errorCode = 5;
                    errorMessage = "Unicode category is not implemented yet...";
                    break;
                case "t":
                    valueType = 0;
                    value.push(0x09);
                    ++pos;
                    valid = true;
                    state = 10;
                    break;
                case "n":
                    valueType = 0;
                    value.push(0x0A);
                    ++pos;
                    valid = true;
                    state = 10;
                    break;
                case "v":
                    valueType = 0;
                    value.push(0x0B);
                    ++pos;
                    valid = true;
                    state = 10;
                    break;
                case "f":
                    valueType = 0;
                    value.push(0x0C);
                    ++pos;
                    valid = true;
                    state = 10;
                    break;
                case "r":
                    valueType = 0;
                    value.push(0x0D);
                    ++pos;
                    valid = true;
                    state = 10;
                    break;
                    //                case '^': case '$':
                    //                case '[': case ']': case '-':
                    //                case '(': case ')':
                    //                case '*': case '+': case '?':
                    //                case '{': case '}':
                    //                case '|':
                    //                case '.':
                    //                case '/':
                    //                case '\\':
                    //                case '#':
                    //                case '"': case '\'':
                default:
                    valueType = 0;
                    value.push(ch.charCodeAt(0));
                    ++pos;
                    valid = true;
                    state = 10;
                }
                break;
            case 2:
            case 3:
                scanResult = RegexParser._scanInteger(str, pos);
                if(scanResult.error.code !== 0)
                {
                    errorCode = scanResult.error.code + 10;
                    errorMessage = scanResult.error.message;
                }
                else
                {
                    valueType = 0;
                    value.push(
                        Number.parseInt(
                            charCodesToString(scanResult.value),
                            (state === 2 ? 10 : 16)
                        )
                    );
                    pos = scanResult.range.getMaximum();
                    valid = true;
                    state = 10;
                }
                break;
            }
        }

        if(errorCode === 0 && !valid)
        {
            errorCode = 4;
            errorMessage = "";
        }

        return new ScannerResult(
            valueType, value,
            new Interval(startIndex, pos),
            new ScannerError(errorCode, errorMessage)
        );
    };

    /**
     *  @param {string} str
     *  @param {number} [startIndex=0]
     *  @param {number} [positiveInfinityValue=Number.MAX_SAFE_INTEGER]
     *  @returns {ScannerResult}
     */
    RegexParser._scanRepetitionOperator = function (str)
    {
        var startIndex = _selectNonUndefined(arguments[1], 0);
        var pos = startIndex;
        var errorCode = 0;
        var errorMessage = "";

        var valueType = 0;
        var min = _minInt;
        var max = _selectNonUndefined(arguments[2], _maxInt);
        var valid = false;

        var scanResult = null;
        var len = str.length;
        var state = 0;

        var scanning = true;
        while(scanning && pos < len)
        {
            switch(state)
            {
            case 0:
                switch(str.charAt(pos))
                {
                case "{":
                    ++pos;
                    ++state;
                    break;
                case "*":
                    min = 0;
                    max = _maxInt;

                    ++pos;
                    valid = true;
                    state = 5;
                    break;
                case "+":
                    min = 1;
                    max = _maxInt;

                    ++pos;
                    valid = true;
                    state = 5;
                    break;
                case "?":
                    min = 0;
                    max = 1;

                    ++pos;
                    valid = true;
                    state = 5;
                    break;
                default:
                    errorCode = 1;
                    errorMessage = "A repetition operator must start with '*', '+', '?' or '{'.";
                    scanning = false;
                }
                break;
            case 1:
                scanResult = RegexParser._scanInteger(str, pos);
                if(scanResult.error.code === 0)
                {
                    min = Number.parseInt(
                        charCodesToString(scanResult.value),
                        (
                            scanResult.valueType === 0
                                ? 10
                                : 16
                        )
                    );
                    pos = scanResult.range.getMaximum();
                    ++state;
                }
                else
                {
                    errorCode = 2;
                    errorMessage = scanResult.error.message;
                    scanning = false;
                }
                break;
            case 2:
                if(str.charAt(pos) === ",")
                {
                    ++pos;
                    ++state;
                }
                else
                {
                    max = min;
                    state = 4;
                }
                break;
            case 3:
                scanResult = RegexParser._scanInteger(str, pos);
                var valueStr = charCodesToString(scanResult.value);
                if(scanResult.error.code === 0 && valueStr !== "")
                {
                    max = Number.parseInt(
                        valueStr,
                        (
                            scanResult.valueType === 0
                                ? 10
                                : 16
                        )
                    );

                    if(min <= max)
                    {
                        pos = scanResult.range.getMaximum();
                        ++state;
                    }
                    else
                    {
                        errorCode = 4;
                        errorMessage = "The minimum value must be equal to or less than the maximum value.";
                        scanning = false;
                    }
                }
                else
                {
                    ++state;
                }
                break;
            case 4:
                if(str.charAt(pos) === "}")
                {
                    ++pos;
                    ++state;
                    valid = true;
                }
                else
                {
                    errorCode = 5;
                    errorMessage = "A repetition operator must end with '}'.";
                    scanning = false;
                }
                break;
            case 5:
                switch(str.charAt(pos))
                {
                case "+":
                    valueType = 1;

                    ++pos;
                    break;
                case "?":
                    valueType = 2;

                    ++pos;
                    break;
                }

                valid = true;
                scanning = false;
                break;
            default:
                errorCode = 7;
                errorMessage = "A fatal error occured when scanning a repetition operator.";
                scanning = false;
            }
        }

        if(scanning && !valid)
        {
            errorCode = 6;
            errorMessage = "Not enough characters for parsing a repetition operator.";
        }

        return new ScannerResult(
            valueType, [min, max],
            new Interval(startIndex, pos),
            new ScannerError(errorCode, errorMessage)
        );
    };

    /**
     *  @param {string} str
     *  @param {number} [startIndex=0]
     *  @returns {ScannerResult}
     */
    RegexParser._scanIdInBraces = function (str)
    {
        var startIndex = arguments[1];
        if(isUndefined(startIndex))
        {
            startIndex = 0;
        }
        else if(!isNonNegativeSafeInteger(startIndex))
        {
            throw new TypeError("'startIndex' must be a non-negative integer.");
        }

        var pos = startIndex;
        var value = [];

        var valid = false;
        var errorCode = 0;
        var errorMessage = "";

        var state = 0;

        while(
            state < 10
            && pos < str.length
            && errorCode === 0
        )
        {
            var ch = str.charAt(pos);

            switch(state)
            {
            case 0:
                if(ch === "{")
                {
                    ++pos;
                    state = 1;
                }
                else
                {
                    errorCode = 1;
                    errorMessage = "An id in braces term must start with '{'.";
                }
                break;
            case 1:
                switch(ch)
                {
                case "_": case "$":
                case "a": case "b": case "c": case "d": case "e":
                case "f": case "g": case "h": case "i": case "j":
                case "k": case "l": case "m": case "n": case "o":
                case "p": case "q": case "r": case "s": case "t":
                case "u": case "v": case "w": case "x": case "y":
                case "z":
                case "A": case "B": case "C": case "D": case "E":
                case "F": case "G": case "H": case "I": case "J":
                case "K": case "L": case "M": case "N": case "O":
                case "P": case "Q": case "R": case "S": case "T":
                case "U": case "V": case "W": case "X": case "Y":
                case "Z":
                    value.push(ch.charCodeAt(0));
                    ++pos;
                    state = 2;
                    break;
                default:
                    errorCode = 2;
                    errorMessage = "An invalid character has been found in the identifier.";
                }
                break;
            case 2:
                switch(ch)
                {
                case "_": case "$":
                case "a": case "b": case "c": case "d": case "e":
                case "f": case "g": case "h": case "i": case "j":
                case "k": case "l": case "m": case "n": case "o":
                case "p": case "q": case "r": case "s": case "t":
                case "u": case "v": case "w": case "x": case "y":
                case "z":
                case "A": case "B": case "C": case "D": case "E":
                case "F": case "G": case "H": case "I": case "J":
                case "K": case "L": case "M": case "N": case "O":
                case "P": case "Q": case "R": case "S": case "T":
                case "U": case "V": case "W": case "X": case "Y":
                case "Z":
                case "0": case "1": case "2": case "3": case "4":
                case "5": case "6": case "7": case "8": case "9":
                    value.push(ch.charCodeAt(0));
                    ++pos;
                    break;
                default:
                    state = 3;
                }
                break;
            case 3:
                if(ch === "}")
                {
                    valid = true;
                    ++pos;
                    state = 10;
                }
                else
                {
                    errorCode = 5;
                    errorMessage = "An id in braces term must end with '}'.";
                }
                break;
            }
        }

        if(errorCode === 0 && !valid)
        {
            errorCode = 10;
            errorMessage = "";
        }

        return new ScannerResult(
            0, value,
            new Interval(startIndex, pos),
            new ScannerError(errorCode, errorMessage)
        );
    };

    /**
     *  @constructor
     */
    RegexParser._CharSetParser = function ()
    {
        this._exprCtxts = [];
        this._str = "";
        this._pos = 0;
        this._state = 0;
    };

    /**
     *  @function
     *  @param {string} str
     *  @param {number} [startIndex=0]
     *  @returns {ScannerResult}
     */
    RegexParser._CharSetParser._scanPosixCharSet = function (str)
    {
        var startIndex = _selectNonUndefined(arguments[1], 0);
        var pos = startIndex;

        var state = 0;
        var ch = "";
        var className = "";

        var valueType = 0;
        var errorCode = 0;
        var errorMessage = "";

        while(
            state < 5
            && errorCode === 0
            && pos < str.length
        )
        {
            switch(state)
            {
            case 0:
                if(str.charAt(pos) === "[")
                {
                    ++pos;
                    ++state;
                }
                else
                {
                    errorCode = 1;
                    errorMessage = "";
                }
                break;
            case 1:
                if(str.charAt(pos) === ":")
                {
                    ++pos;
                    ++state;
                }
                else
                {
                    errorCode = 2;
                    errorMessage = "";
                }
                break;
            case 2:
                ch = str.charAt(pos);
                if(ch === "^")
                {
                    valueType = 1;
                    ++pos;
                }

                ++state;
                break;
            case 3:
                ch = str.charAt(pos);
                if(ch >= "A" && ch <= "z")
                {
                    className += ch;
                    ++pos;
                }
                else if(ch === ":")
                {
                    ++pos;
                    ++state;
                }
                else
                {
                    errorCode = 3;
                    errorMessage = "";
                }
                break;
            case 4:
                if(str.charAt(pos) === "]")
                {
                    ++pos;
                    ++state;
                }
                else
                {
                    errorCode = 4;
                    errorMessage = "";
                }
                break;
            }
        }

        if(state < 5)
        {
            errorCode = 5;
            errorMessage = "";
        }

        return new ScannerResult(
            valueType, stringToCharCodes(className),
            new Interval(startIndex, pos),
            new ScannerError(errorCode, errorMessage)
        );
    };

    /**
     *  @constructor
     *  @param {Array.<Interval>} codeRanges
     *  @param {Interval} textRange
     *  @param {ScannerError} [error]
     */
    RegexParser._CharSetParser.Result = function (codeRanges, textRange)
    {
        this.codeRanges = codeRanges;
        this.textRange = textRange;

        this.error = arguments[3];
        if(isUndefinedOrNull(this.error))
        {
            this.error = new ScannerError();
        }
    };

    /**
     *  @constructor
     *  @param {number} type
     *  @param {Object} value
     */
    RegexParser._CharSetParser._Term = function (type, value)
    {
        this._type = type;
        this._value = value;
    };

    /**
     *  @constructor
     *  @param {number} returnState
     */
    RegexParser._CharSetParser._ExprContext = function (returnState)
    {
        if(!isNonNegativeSafeInteger(returnState))
        {
            throw new TypeError("'returnState' must be a non-negative safe integer.");
        }

        this._returnState = returnState;
        this._negated = false;
        this._terms = [];
    };

    /**
     *  @function
     *  @returns {number}
     */
    RegexParser._CharSetParser._ExprContext.prototype.isEmpty = function ()
    {
        return this._terms.length < 1;
    };

    /**
     *  @function
     *  @returns {RegexParser._CharSetParser._Term}
     */
    RegexParser._CharSetParser._ExprContext.prototype.getLastTerm = function ()
    {
        if(this.isEmpty())
        {
            throw new Error("Expression context term stack underflow.");
        }

        return this._terms[this._terms.length - 1];
    };

    /**
     *  @function
     *  @param {Object} arg
     */
    RegexParser._CharSetParser._ExprContext.prototype.pushTerm = function (arg)
    {
        var newTerm = null;
        if(isNonNegativeSafeInteger(arg))
        {
            newTerm = new RegexParser._CharSetParser._Term(
                0,
                arg
            );
        }
        else if(arg instanceof Interval)
        {
            newTerm = new RegexParser._CharSetParser._Term(
                1,
                [arg]
            );
        }
        else if(Array.isArray(arg))
        {
            newTerm = new RegexParser._CharSetParser._Term(
                1,
                arg
            );
        }
        else
        {
            throw new TypeError("");
        }

        this._terms.push(newTerm);
    };

    /**
     *  @function
     *  @returns {Array.<Interval>}
     */
    RegexParser._CharSetParser._ExprContext.prototype.evaluate = function ()
    {
        var finalRanges = [];
        for(var i = 0; i < this._terms.length; ++i)
        {
            var term = this._terms[i];
            switch(term._type)
            {
            case 0:
                finalRanges.push(
                    new Interval(term._value, term._value)
                );
                break;
            case 1:
                finalRanges = finalRanges.concat(term._value);
                break;
            }
        }

        return (
            (
                !this._negated
                    ? Interval.merge(finalRanges, _minInt, _maxInt)
                    : Interval.negate(finalRanges, _minInt, _maxInt)
            )
        );
    };

    /**
     *  @function
     *  @param {string} str
     *  @param {number} [startIndex=0]
     *  @returns {RegexParser._CharSetParser.Result}
     */
    RegexParser._CharSetParser.prototype.parse = function (str)
    {
        this._str = str;

        var startIndex = _selectNonUndefined(arguments[1], 0);
        this._pos = startIndex;

        var valid = false;
        var errorCode = 0;
        var errorMessage = "";
        var scanResult = null;

        // var negated = false;
        var finalRanges = null;

        this._state = 0;
        while(
            this._state < 10
            && this._pos < this._str.length
            && errorCode === 0
        )
        {
            var exprCtxt = null;
            var ch = this._str.charAt(this._pos);

            switch(this._state)
            {
            case 0:
                if(ch === "[")
                {
                    this._exprCtxts.push(
                        new RegexParser._CharSetParser._ExprContext(this._state)
                    );

                    ++this._pos;
                    this._state = 1;
                }
                else
                {
                    errorCode = 1;
                    errorMessage = "";
                }
                break;
            case 1:
                if(ch === "^")
                {
                    exprCtxt = this._getLastExprContext();
                    exprCtxt._negated = true;
                }

                this._state = 2;
                break;
            case 2:
                switch(ch)
                {
                case "[":
                    ++this._pos;
                    this._state = 3;
                    break;
                case "]":
                    switch(this._exprCtxts.length)
                    {
                    case 0:
                        errorCode = 11;
                        errorMessage = "There's no character sets to close.";
                        break;
                    case 1:
                        exprCtxt = this._exprCtxts.pop();
                        finalRanges = exprCtxt.evaluate();

                        valid = true;
                        ++this._pos;
                        this._state = 10;
                        break;
                    default:
                        var ctxtToEval = this._exprCtxts.pop();
                        this._getLastExprContext().pushTerm(ctxtToEval.evaluate());

                        ++this._pos;
                        this._state = ctxtToEval._returnState;
                    }
                    break;
                case "-":
                    exprCtxt = this._getLastExprContext();
                    if(!exprCtxt.isEmpty())
                    {
                        ++this._pos;
                        this._state = 4;
                    }
                    else
                    {
                        errorCode = 7;
                        errorMessage = "Range operators or "
                            + "character set difference operators "
                            + "must be appered after a left hand side term."
                        ;
                    }
                    break;
                case "&":
                    errorCode = 2;
                    errorMessage = "Character set intersection operator"
                        + " is not implemented yet..."
                    ;
                    break;
                case "\\":
                    scanResult = RegexParser._scanEscapedCharacter(this._str, this._pos);
                    if(scanResult.error.code === 0)
                    {
                        exprCtxt = this._getLastExprContext();

                        switch(scanResult.valueType)
                        {
                        case 0:
                            exprCtxt.pushTerm(scanResult.value[0]);

                            this._pos = scanResult.range.getMaximum();
                            break;
                        case 1:
                            exprCtxt.pushTerm(
                                Enum.getValueAt(
                                    RegexParser._CharRange,
                                    scanResult.value[0]
                                ).getRange()
                            );

                            this._pos = scanResult.range.getMaximum();
                            break;
                        case 2:
                            exprCtxt.pushTerm(
                                Enum.getValueAt(
                                    RegexParser._CharRangeSet,
                                    scanResult.value[0]
                                ).getRanges()
                            );

                            this._pos = scanResult.range.getMaximum();
                            break;
                        case 3:
                            errorCode = 2;
                            errorMessage = "Referencing captures in character set is not valid.";
                            break;
                        }
                    }
                    else
                    {
                        errorCode = scanResult.error.code + 20;
                        errorMessage = scanResult.error.message;
                    }
                    break;
                default:
                    exprCtxt = this._getLastExprContext();
                    exprCtxt.pushTerm(ch.charCodeAt(0));

                    ++this._pos;
                }
                break;
            case 3:
                switch(ch)
                {
                case ":":
                    --this._pos;
                    scanResult = RegexParser
                        ._CharSetParser
                        ._scanPosixCharSet(this._str, this._pos)
                    ;
                    if(scanResult.error.code === 0)
                    {
                        exprCtxt = this._getLastExprContext();

                        var charSet = RegexParser._CharRangeSet[
                            charCodesToString(scanResult.value)
                        ].getRanges();
                        if(scanResult.valueType !== 0)
                        {
                            charSet = Interval.negate(
                                charSet,
                                _minInt,
                                _maxInt
                            );
                        }
                        exprCtxt.pushTerm(charSet);

                        this._pos = scanResult.range.getMaximum();
                        this._state = 2;
                    }
                    else
                    {
                        errorCode = scanResult.error.code + 10;
                        errorMessage = scanResult.error.message;
                    }
                    break;
                case "=":
                    errorCode = 3;
                    errorMessage = "Posix collation sequences are not supported.";
                    break;
                case ".":
                    errorCode = 4;
                    errorMessage = "Posix character equivalences are not supported.";
                    break;
                default:
                    --this._pos;
                    this._state = 0;
                }
                break;
            case 4:
                exprCtxt = this._getLastExprContext();
                var rangeMax = 0;
                var lastTerm = exprCtxt._terms[exprCtxt._terms.length - 1];
                if(lastTerm._type === 0)
                {
                    switch(ch)
                    {
                    case "["://Character set difference operator
                        //TODO : Write some proper codes...
                        throw new Error("Write some proper codes!");
                    // break;
                    case "\\"://Range operator
                        scanResult = RegexParser._scanEscapedCharacter(this._str, this._pos);
                        if(scanResult.error.code === 0)
                        {
                            switch(scanResult.valueType)
                            {
                            case 0:
                                rangeMax = scanResult.value[0];

                                this._pos = scanResult.range.getMaximum();
                                break;
                            case 1:
                            case 2:
                            case 3:
                                errorCode = 2;
                                errorMessage = "The right hand side of range operators must be a single character.";
                                break;
                            }
                        }
                        else
                        {
                            errorCode = scanResult.error.code + 20;
                            errorMessage = scanResult.error.message;
                        }
                        break;
                    default://Range operator
                        rangeMax = ch.charCodeAt(0);

                        ++this._pos;
                    }

                    if(errorCode === 0)
                    {
                        exprCtxt._terms.pop();
                        exprCtxt.pushTerm(new Interval(lastTerm._value, rangeMax));

                        this._state = 2;
                    }
                }
                else
                {
                    errorCode = 80;
                    errorMessage = "The left hand side of range operators"
                        + " must be a single character."
                    ;
                }
                break;
            case 5:
                //TODO : Do character set operation
                //after the rhs character set has been parsed.

                break;
            case 6:
                if(ch === "]")
                {
                    //TODO : Create final ranges.
                    throw new Error("Write some proper codes!");
                }
                else
                {
                    errorCode = 90;
                    errorMessage = "More terms"
                        + " after character set operation"
                        + " is not allowed."
                    ;
                }
                break;
            }
        }

        if(errorCode === 0 && !valid)
        {
            errorCode = 50;
            errorMessage = "";
        }

        return new RegexParser._CharSetParser.Result(
            finalRanges,
            new Interval(startIndex, this._pos),
            new ScannerError(errorCode, errorMessage)
        );
    };

    /**
     *  @private
     *  @function
     *  @returns {RegexParser._CharSetParser._ExprContext}
     */
    RegexParser._CharSetParser.prototype._getLastExprContext = function ()
    {
        if(this._exprCtxts.length < 1)
        {
            throw new Error("No more character set contexts left.");
        }

        return this._exprCtxts[this._exprCtxts.length - 1];
    };

    //테스트용 코드 삭제
    //karbonator.detail._CharSetParser = RegexParser._CharSetParser;

    /**
     *  @constructor
     */
    RegexParser._ExprContext = function ()
    {
        this._opStack = [];
        this._termNodeStack = [];
        this._lastNodeType = -1;
    };

    /**
     *  @function
     *  @returns {number}
     */
    RegexParser._ExprContext.prototype.getTermNodeCount = function ()
    {
        return this._termNodeStack.length;
    };

    /**
     *  @function
     *  @param {number} opKey
     *  @param {Array.<Object>} [staticArgs]
     */
    RegexParser._ExprContext.prototype.pushOperator = function (opKey)
    {
        if(!isNonNegativeSafeInteger(opKey))
        {
            throw new TypeError("The parameter 'opKey' must be a non-negative safe integer.");
        }

        var opType = _opTypeMap.get(opKey);
        if(isUndefinedOrNull(opType))
        {
            throw new Error("A fatal error has occured. Cannot find the operator type information.");
        }

        var op = new Operator(opType, arguments[1]);
        //TODO : tokenExpressionCall을 term 취급하기 위한 임시 조치.
        if(opType.getParameterCount() < 2)
        {
            //TODO : 임시 조치
            if(opType.getKey() === OperatorTypeKeys.tokenExpressionCall)
            {
                if(
                    this._termNodeStack.length >= 1
                    && this._lastNodeType === RegexParser.AstNodeType.terminal
                )
                {
                    this.pushOperator(OperatorTypeKeys.concatenation);
                }
            }

            this._createAndPushOperatorNode(op);
        }
        else
        {
            while(
                this._opStack.length > 0
            )
            {
                var lastOp = this._opStack[this._opStack.length - 1];
                var lastOpType = lastOp.getType();
                if(
                    lastOpType.precedes(opType)
                    || (
                        opType.getAssociativity() === OperatorType.Associativity.leftToRight
                        && !opType.precedes(lastOpType)
                    )
                )
                {
                    this._createAndPushOperatorNode(lastOp);
                    this._opStack.pop();
                }
                else
                {
                    break;
                }
            }

            this._opStack.push(op);
            this._lastNodeType = RegexParser.AstNodeType.operator;
        }
    };

    /**
     *  @function
     *  @param {Number|Interval|Array.<Interval>|AstNode} arg
     */
    RegexParser._ExprContext.prototype.pushTerm = function (arg)
    {
        var termNode = null;
        if(arg instanceof AstNode)
        {
            termNode = arg;
        }
        else if(isNonNegativeSafeInteger(arg))
        {
            termNode = new AstNode(
                RegexParser.AstNodeType.terminal,
                [new Interval(arg, arg)]
            );
        }
        else if(arg instanceof Interval)
        {
            termNode = new AstNode(
                RegexParser.AstNodeType.terminal,
                [arg]
            );
        }
        else if(Array.isArray(arg))
        {
            termNode = new AstNode(
                RegexParser.AstNodeType.terminal,
                arg
            );
        }
        else
        {
            throw new TypeError(
                "The argument must be either "
                + "'AstNode', 'Interval', an array of 'Interval'"
                + ", or a non-negative safe integer."
            );
        }

        if(
            this._termNodeStack.length >= 1
            && this._lastNodeType === RegexParser.AstNodeType.terminal
        )
        {
            this.pushOperator(OperatorTypeKeys.concatenation);
        }

        this._termNodeStack.push(termNode);
        this._lastNodeType = RegexParser.AstNodeType.terminal;
    };

    /**
     *  @function
     *  @returns {AstNode|null}
     */
    RegexParser._ExprContext.prototype.evaluateAll = function ()
    {
        while(this._opStack.length > 0)
        {
            var op = this._opStack.pop();
            this._createAndPushOperatorNode(op);
        }

        if(this._termNodeStack.length !== 1)
        {
            //Error
            throw new Error("There are some not calculated term nodes.");

            //return null;
        }
        else
        {
            return this._termNodeStack.pop();
        }
    };

    /**
     *  @private
     *  @function
     *  @param {Operator} op
     */
    RegexParser._ExprContext.prototype._createAndPushOperatorNode = function (op)
    {
        if(!(op instanceof Operator))
        {
            throw new TypeError("'op' must be an instance of 'Operator'.");
        }

        var opType = op.getType();

        var termNodeCount = this._termNodeStack.length;
        var paramCount = opType.getParameterCount();
        if(termNodeCount < paramCount)
        {
            throw new Error("Not enough parameters.");
        }

        var opNode = new AstNode(RegexParser.AstNodeType.operator, op);
        var startTermNodeIndex = termNodeCount - paramCount;
        for(var i = startTermNodeIndex; i < termNodeCount; ++i)
        {
            opNode.addChild(this._termNodeStack[i]);
        }
        this._termNodeStack.splice(startTermNodeIndex, paramCount);

        this._termNodeStack.push(opNode);

        //TODO : 코드 최적화
        if(paramCount === 2)
        {
            var childNode = null;

            switch(opType.getAssociativity())
            {
            case OperatorType.Associativity.none:
                break;
            case OperatorType.Associativity.leftToRight:
                childNode = opNode.getChildAt(0);
                if(
                    !childNode.isRootOfGroup()
                    && childNode.getType() === RegexParser.AstNodeType.operator
                    && childNode.getValue().getType().equals(op.getType())
                    //A stub for static argument array comparison.
                    && (
                        op.getStaticArgumentCount() === 0
                        && childNode.getValue().getStaticArgumentCount() === 0
                    )
                )
                {
                    opNode.removeChildAt(0);
                    opNode.insertChildren(
                        childNode.removeAllChildren(),
                        0
                    );
                }
                break;
            //TODO : 코드 검증
            case OperatorType.Associativity.rightToLeft:
                childNode = opNode.getChildAt(1);
                if(
                    !childNode.isRootOfGroup()
                    && childNode.getType() === RegexParser.AstNodeType.operator
                    && childNode.getValue().getType().equals(op.getType())
                    //A stub for static argument array comparison.
                    && (
                        op.getStaticArgumentCount() === 0
                        && childNode.getValue().getStaticArgumentCount() === 0
                    )
                )
                {
                    opNode.removeChildAt(1);
                    opNode.insertChildren(
                        childNode.removeAllChildren(),
                        opNode.getChildCount()
                    );
                }
                break;
            default:
                throw new Error("An unknown associativity value of an operator has been found.");
            }
        }

        this._lastNodeType = RegexParser.AstNodeType.terminal;
    };

    /**
     *  @function
     *  @param {string} regexStr
     *  @param {number} [tokenKey=0]
     *  @param {Map<string, number>} [tokenNameKeyMap]
     *  @returns {AstNode}
     */
    RegexParser.prototype.parse = function (regexStr)
    {
        if(!isString(regexStr))
        {
            throw new TypeError("'regexStr' must be a string that represents a regular expression.");
        }

        var tokenKey = arguments[1];
        if(isUndefined(tokenKey))
        {
            tokenKey = 0;
        }
        else if(!isNonNegativeSafeInteger(tokenKey))
        {
            throw new TypeError("'tokenKey' must be a non-negative safe integer.");
        }

        var tokenNameKeyMap = arguments[2];
        if(isUndefined(tokenNameKeyMap))
        {
            throw new TypeError(
                "'tokenNameKeyMap'"
                + " must be a "
                + "{string, non-negative integer}"
                + " map collection."
            );
        }

        var charSetParser = new RegexParser._CharSetParser();

        this._regexStr = regexStr;
        this._state = 0;
        this._exprCtxStack.length = 0;
        this._exprCtxStack.push(new RegexParser._ExprContext());
        this._pos = 0;
        this._error.occured = false;

        this._parsing = true;

        //1. infix to postfix 및 postfix 계산기 기법 활용
        //2. 반복 연산자는 연산자 스택에 넣지 말고
        //   가장 마지막으로 입력된 character-term에 대해 바로 연산을 수행 해서
        //   토큰 스택에는 반복 연산자가 없는 것처럼 처리.
        //3. ')'가 입력되는 순간 '('까지의 모든 연산자들을 즉시 계산하고
        //   토큰 스택에는 반복 연산자가 없는 것처럼 처리.
        //4. '('가 입력되면 concat 연산자를 먼저 push하고 '('를 스택에 push.
        //5. character-term이 입력되면 concat 연산자를 먼저 연산자 스택에 push하고
        //   입력된 character-term을 토큰 스택에 push.

        for(
            var regexLen = this._regexStr.length;
            this._parsing && this._pos < regexLen;
        )
        {
            var groupRootNode = null;
            var scanResult = null;

            var exprCtx = this._getLastExpressionContext();
            var ch = this._regexStr.charAt(this._pos);

            switch(this._state)
            {
            case 0:
                switch(ch)
                {
                case "\r": case "\n":
                    break;
                case "^":
                    this._cancelParsing("Start of string anchor is not implemented yet...");
                    break;
                case "$":
                    this._cancelParsing("End of string anchor is not implemented yet...");
                    break;
                case "(":
                    this._exprCtxStack.push(new RegexParser._ExprContext());

                    this._moveToNextIfNoError();
                    break;
                case ")":
                    if(this._exprCtxStack.length >= 1)
                    {
                        groupRootNode = exprCtx.evaluateAll();
                        if(null !== groupRootNode)
                        {
                            groupRootNode.setRootOfGroup(true);
                            this._exprCtxStack.pop();
                            this._getLastExpressionContext().pushTerm(groupRootNode);

                            this._moveToNextIfNoError();
                        }
                        else
                        {
                            this._cancelParsing("There are some errors in the grouped expression.");
                        }
                    }
                    else
                    {
                        this._cancelParsing("There is no open parenthesis.");
                    }
                    break;
                case "{":
                    ++this._pos;
                    this._state = 1;
                    break;
                case "*": case "+": case "?":
                    this._processRepetitionOperator();
                    break;
                case "}":
                    this._cancelParsing("An invalid token that specifies end of constrained repetition has been found.");
                    break;
                case "|":
                    exprCtx.pushOperator(OperatorTypeKeys.alternation);

                    this._moveToNextIfNoError();
                    break;
                case "\\":
                    scanResult = RegexParser._scanEscapedCharacter(
                        this._regexStr,
                        this._pos
                    );
                    if(scanResult.error.code === 0)
                    {
                        switch(scanResult.valueType)
                        {
                        case 0:
                            exprCtx.pushTerm(scanResult.value[0]);

                            this._pos = scanResult.range.getMaximum();
                            break;
                        case 1:
                            exprCtx.pushTerm(
                                Enum.getValueAt(
                                    RegexParser._CharRange,
                                    scanResult.value[0]
                                ).getRange()
                            );

                            this._pos = scanResult.range.getMaximum();
                            break;
                        case 2:
                            exprCtx.pushTerm(
                                Enum.getValueAt(
                                    RegexParser._CharRangeSet,
                                    scanResult.value[0]
                                ).getRanges()
                            );

                            this._pos = scanResult.range.getMaximum();
                            break;
                        case 3:
                            this._cancelParsing("Back referencing is not supported.");
                            break;
                        }
                    }
                    else
                    {
                        this._cancelParsing(scanResult.error.message);
                    }
                    break;
                case "[":
                    var charSetResult = charSetParser.parse(
                        this._regexStr,
                        this._pos
                    );
                    if(charSetResult.error.code === 0)
                    {
                        exprCtx.pushTerm(charSetResult.codeRanges);

                        this._pos = charSetResult.textRange.getMaximum();
                    }
                    else
                    {
                        this._cancelParsing(charSetResult.error.message);
                    }
                    break;
                case "]":
                    this._cancelParsing("An invalid token that specifies end of a character set has been found.");
                    break;
                case ".":
                    exprCtx.pushTerm(RegexParser._CharRange.anyChars.getRange());

                    this._moveToNextIfNoError();
                    break;
                default:
                    exprCtx.pushTerm(this._regexStr.charCodeAt(this._pos));

                    this._moveToNextIfNoError();
                }
                break;
            case 1://Starts with '{'.
                switch(ch)
                {
                case "0": case "1": case "2": case "3": case "4":
                case "5": case "6": case "7": case "8": case "9":
                    --this._pos;
                    this._processRepetitionOperator();

                    this._state = 0;
                    break;
                default:
                    --this._pos;
                    scanResult = RegexParser._scanIdInBraces(
                        this._regexStr,
                        this._pos
                    );
                    if(scanResult.error.code === 0)
                    {
                        var targetTokenName = charCodesToString(scanResult.value);
                        var targetTokenKey = tokenNameKeyMap.get(targetTokenName);
                        if(!isUndefined(targetTokenKey))
                        {
                            exprCtx.pushOperator(
                                OperatorTypeKeys.tokenExpressionCall,
                                [targetTokenKey]
                            );

                            this._pos = scanResult.range.getMaximum();
                            this._state = 0;
                        }
                        else
                        {
                            this._cancelParsing("'" + targetTokenName + "' is not defined.");
                        }
                    }
                    else
                    {
                        this._cancelParsing(scanResult.error.message);
                    }
                }
                break;
            case 2://Starts with '('.

                break;
            }
        }

        var astRootNode = null;
        var exprRootNode = null;
        if(this._parsing)
        {
            this._parsing = false;
            exprRootNode = this._getLastExpressionContext().evaluateAll();
        }

        if(null !== exprRootNode)
        {
            astRootNode = new AstNode(
                RegexParser.AstNodeType.operator,
                new Operator(
                    _opTypeMap.get(OperatorTypeKeys.accept),
                    [tokenKey]
                )
            );
            astRootNode.addChild(exprRootNode);
        }
        else
        {
            this._cancelParsing(this._error.message);
        }

        return astRootNode;
    };

    /**
     *  @returns {RegexParser._ExprContext}
     */
    RegexParser.prototype._getLastExpressionContext = function ()
    {
        return this._exprCtxStack[this._exprCtxStack.length - 1];
    };

    RegexParser.prototype._processRepetitionOperator = function ()
    {
        var scanResult = RegexParser._scanRepetitionOperator(
            this._regexStr,
            this._pos
        );
        if(scanResult.error.code === 0)
        {
            if(scanResult.valueType === 1)
            {
                this._cancelParsing("Possessive quantifiers are not supported.");
            }
            else
            {
                this._getLastExpressionContext().pushOperator(
                    OperatorTypeKeys.repetition,
                    [
                        scanResult.valueType,
                        new Interval(
                            scanResult.value[0],
                            scanResult.value[1]
                        )
                    ]
                );

                this._pos = scanResult.range.getMaximum();
            }
        }
        else
        {
            this._cancelParsing(scanResult.error.message);
        }
    };

    RegexParser.prototype._moveToNextIfNoError = function ()
    {
        if(!this._error.occured)
        {
            ++this._pos;
        }
    };

    /**
     *  @param {string} [message]
     *  @param {number} [position]
     */
    RegexParser.prototype._cancelParsing = function ()
    {
        this._error = {
            occured : true,
            message : _selectNonUndefined(arguments[0], "An error occured."),
            position : _selectNonUndefined(arguments[1], this._pos)
        };

        this._parsing = false;
    };

    /*////////////////////////////////*/

    /*////////////////////////////////*/
    //InstructionBuffer

    /**
     *  @constructor
     *  @param {InstructionBuffer|Boolean} arg0
     */
    function InstructionBuffer(arg0)
    {
        if(arg0 instanceof InstructionBuffer)
        {
            this._byteOrderReversed = arg0._byteOrderReversed;
            this._lines = new Array(arg0._lines.length);
            for(var i = 0; i < arg0._lines.length; ++i)
            {
                this._lines[i] = arg0._lines[i].slice();
            }

            this._lineAddrs = null;
        }
        else
        {
            this._byteOrderReversed = !!arg0;
            this._lines = [];

            this._lineAddrs = null;
        }
    }

    /**
     *  @returns {number}
     */
    InstructionBuffer.prototype.getCount = function ()
    {
        return this._lines.length;
    };

    /**
     *  @param {number} index
     *  @returns {Array}
     */
    InstructionBuffer.prototype.getLineAt = function (index)
    {
        return this._lines[index];
    };

    /**
     *  @param {InstructionBuffer} rhs
     *  @returns {InstructionBuffer}
     */
    InstructionBuffer.prototype.add = function (rhs)
    {
        if(!(rhs instanceof InstructionBuffer))
        {
            throw new TypeError("'rhs' must be an instanceof 'InstructionBuffer'.");
        }

        for(var i = 0, len = rhs._lines.length; i < len; ++i)
        {
            this._lines.push(_copyIntArray(rhs._lines[i]));
        }

        return this;
    };

    /**
     *  @param {InstructionBuffer} rhs
     *  @returns {InstructionBuffer}
     */
    InstructionBuffer.prototype.consume = function (rhs)
    {
        this.add(rhs);

        rhs.clear();

        return this;
    };

    /**
     *  @param {RegexVmInstruction} inst
     *  @param {...Number} [operands]
     *  @returns {InstructionBuffer}
     */
    InstructionBuffer.prototype.putFront = function (inst)
    {
        if(!(inst instanceof RegexVmInstruction))
        {
            throw new TypeError("The parameter 'inst' must be an instance of 'RegexVmInstruction.'.");
        }

        var line = [inst.getOpCode()];
        var args = Array.prototype.slice.call(arguments);
        for(var i = 1; i < args.length; ++i)
        {
            var arg = args[i];
            if(!isNumber(arg))
            {
                throw new TypeError("Optional arguments must be numbers.");
            }

            line.push(arg);
        }

        this._lines.splice(0, 0, line);

        return this;
    };

    /**
     *  @param {RegexVmInstruction} inst
     *  @param {...Number} [operands]
     *  @returns {InstructionBuffer}
     */
    InstructionBuffer.prototype.put = function (inst)
    {
        if(!(inst instanceof RegexVmInstruction))
        {
            throw new TypeError("The parameter 'inst' must be an instance of 'RegexVmInstruction.'.");
        }

        var line = [inst.getOpCode()];
        var args = Array.prototype.slice.call(arguments);
        for(var i = 1; i < args.length; ++i)
        {
            var arg = args[i];
            if(!isNumber(arg))
            {
                throw new TypeError("Optional arguments must be numbers.");
            }

            line.push(arg);
        }

        this._lines.push(line);

        return this;
    };

    /**
     *  @returns {InstructionBuffer}
     */
    InstructionBuffer.prototype.clear = function ()
    {
        this._lines.length = 0;

        return this;
    };

    /**
     *  @param {Interval[]} ranges
     *  @param {number[]} rangeIndexSets
     *  @returns {RegexVmBytecode}
     */
    InstructionBuffer.prototype.printBytecode = function (ranges, rangeIndexSets)
    {
        var i = 0, j = 0;
        var line = null;
        var inst = null;

        var lineLen = this._lines.length;
        for(i = 0; i < lineLen; ++i)
        {
            line = this._lines[i];

            inst = RegexVm.findInstructionByOpCode(line[0]);
            for(j = 0; j < inst.getOperandCount(); ++j)
            {
                if(inst.getOperandTypeAt(j) === RegexVm.OperandType.offset)
                {
                    var offset = line[j + 1];

                    line[j + 1] = (
                        offset < 0
                            ? -this._calculateByteCount(i + offset + 1, i + 1)
                            : this._calculateByteCount(i + 1, i + offset + 1)
                    );
                }
                else if(inst.getOperandTypeAt(j) === RegexVm.OperandType.address)
                {
                    line[j + 1] = this._calculateByteCount(0, line[j + 1]);
                }
            }
        }

        this._lineAddrs = new Array(this._lines.length);
        var codeBlock = new ByteArray();
        for(i = 0; i < lineLen; ++i)
        {
            line = this._lines[i];
            this._lineAddrs[i] = codeBlock.getElementCount();

            var opCode = line[0] & 0xFF;
            codeBlock.pushBack(opCode);

            inst = RegexVm.findInstructionByOpCode(opCode);
            for(j = 0; j < inst.getOperandCount(); ++j)
            {
                var opType = inst.getOperandTypeAt(j);
                opType.valueToBytes(
                    line[j + 1],
                    this._byteOrderReversed,
                    codeBlock
                );
            }
        }

        return new RegexVmBytecode(
            ranges,
            rangeIndexSets,
            this._byteOrderReversed,
            codeBlock,
            this.toString()
        );
    };

    InstructionBuffer.prototype.toString = function ()
    {
        var str = "";

        var offset = 0;
        for(var i = 0, len = this._lines.length; i < len; ++i)
        {
            var line = this._lines[i];
            var inst = RegexVm.findInstructionByOpCode(line[0]);

            str += offset + "\t";

            str += i + "\t";

            str += inst.getMnemonic();

            for(var j = 1; j < line.length; ++j)
            {
                str += " ";
                str += line[j];
            }

            str += "\r\n";

            offset += inst.getSize();
        }

        return str;
    };

    /**
     *  @param {number} startLineIndex
     *  @param {number} endLineIndex
     *  @returns {number}
     */
    InstructionBuffer.prototype._calculateByteCount = function (
        startLineIndex,
        endLineIndex
    )
    {
        if(startLineIndex < 0)
        {
            throw new RangeError("'startLineIndex' can not be less than zero.");
        }

        return this._lines
            .slice(startLineIndex, endLineIndex)
            .reduce(
                function (acc, line)
                {
                    return acc + RegexVm.findInstructionByOpCode(line[0]).getSize();
                },
                0
            )
        ;
    };

    /*////////////////////////////////*/

    /*////////////////////////////////*/
    //CodeEmitter

    /**
     *  @constructor
     */
    function CodeEmitter()
    {
        this._tokenKeySrNdxMap = new RbTreeMap(null, integerComparator);
        this._localSrBuffers = [];
        this._tokenSrBuffers = [];
        this._keyTokenMap = null;

        this._ranges = new ArraySet(null, _edgeEqualComparator);
        this._rangeIndexSets = new ArraySet(
            null,
            function (l, r)
            {
                function diff(l, r)
                {
                    var lenDiff = l.length - r.length;
                    if(lenDiff !== 0)
                    {
                        return lenDiff;
                    }

                    for(var i = 0; i < l.length; ++i)
                    {
                        var ndxDiff = l[i] - r[i];
                        if(ndxDiff !== 0)
                        {
                            return ndxDiff;
                        }
                    }

                    return 0;
                }

                return diff(l, r) === 0;
            }
        );
        this._nodeCodeMap = new ArrayMap();

        this._byteOrderReversed = true;
        this._rootNode = null;
    }

    /**
     *  @param {AstNode} rootNode
     *  @param {ArrayMap} keyTokenMap
     *  @returns {RegexVmBytecode}
     */
    CodeEmitter.prototype.emitCode = function (rootNode, keyTokenMap)
    {
        if(!(rootNode instanceof AstNode))
        {
            throw new TypeError("The parameter must be an instance of 'AstNode'.");
        }

        this._keyTokenMap = keyTokenMap;
        this._tokenKeySrNdxMap.clear();
        this._localSrBuffers.length = 0;
        this._tokenSrBuffers.length = 0;
        this._ranges.clear();
        this._rangeIndexSets.clear();
        this._nodeCodeMap.clear();
        this._rootNode = rootNode;

        for(
            var iter = this._rootNode.beginPostfix(),
                endIter = this._rootNode.endPostfix();
            !iter.equals(endIter);
            iter.moveToNext()
        )
        {
            this._processNode(iter.dereference());
        }

        var instBuffer = this._nodeCodeMap.get(rootNode);

        var bytecode = instBuffer.printBytecode(
            Array.from(this._ranges),
            Array.from(this._rangeIndexSets)
        );

        this._keyTokenMap = null;

        return bytecode;
    };

    /**
     *  @param {AstNode} node
     */
    CodeEmitter.prototype._processNode = function (node)
    {
        if(this._nodeCodeMap.has(node))
        {
            throw new Error("The node has been already processed.");
        }

        var buffer = new InstructionBuffer(this._byteOrderReversed);

        if(node.isRootOfGroup())
        {
            buffer.put(RegexVmInstruction.beginGroup, 0);
        }

        switch(node.getType())
        {
        case RegexParser.AstNodeType.operator:
            var op = node.getValue();
            switch(op.getType().getKey())
            {
            case OperatorTypeKeys.accept:
                buffer = this._visitAccept(
                    buffer,
                    node,
                    op.getStaticArguments()
                );
                break;
            case OperatorTypeKeys.tokenExpressionCall:
                buffer = this._visitTokenExpressionCall(
                    buffer,
                    node,
                    op.getStaticArguments()
                );
                break;
            case OperatorTypeKeys.regexAlternation:
                buffer = this._visitRegexAlternation(
                    buffer,
                    node,
                    op.getStaticArguments()
                );
                break;
            case OperatorTypeKeys.alternation:
                buffer = this._visitAlternation(
                    buffer,
                    node,
                    op.getStaticArguments()
                );
                break;
            case OperatorTypeKeys.concatenation:
                buffer = this._visitConcatenation(
                    buffer,
                    node,
                    op.getStaticArguments()
                );
                break;
            case OperatorTypeKeys.repetition:
                buffer = this._visitRepetition(
                    buffer,
                    node,
                    op.getStaticArguments()
                );
                break;
            default:
                throw new Error("An unknown operator has been found.");
            }
            break;
        case RegexParser.AstNodeType.terminal:
            buffer = this._visitTerminal(
                buffer,
                node
            );
            break;
        default:
            throw new Error("An unknown ast node type has been detected.");
        }

        if(node.isRootOfGroup())
        {
            buffer.put(RegexVmInstruction.endGroup, 0);
        }

        this._nodeCodeMap.set(node, buffer);
    };

    /**
     *  @param {InstructionBuffer} buffer
     *  @param {AstNode} node
     *  @returns {InstructionBuffer}
     */
    CodeEmitter.prototype._visitRegexAlternation = function (buffer, node)
    {
        var offsetInfo = this._caculateSumOfChildCodeOffset(node);
        var offset = offsetInfo.sum;
        var childCount = node.getChildCount();
        var codeLen = 2;
        var calledTokenCount = 0;
        for(var i = 0; i < childCount; ++i)
        {
            var childNode = node.getChildAt(i);
            if(
                childNode.getType() !== RegexParser.AstNodeType.operator
                || childNode.getValue().getType().getKey() !== OperatorTypeKeys.accept
            )
            {
                throw new Error("Parameter nodes of 'regexAlternation' operator must be 'accept' operator nodes.");
            }

            var token = this._keyTokenMap.get(childNode.getValue().getStaticArguments()[0]);
            if(token._subRoutineOnly)
            {
                continue;
            }

            if(i < childCount - 1)
            {
                offset -= offsetInfo.lengths[i];
                buffer.put(RegexVmInstruction.fork, 0, offsetInfo.lengths[i] + 1);
            }

            buffer.consume(this._nodeCodeMap.get(childNode));

            if(i < childCount - 1)
            {
                buffer.put(RegexVmInstruction.bra, (childCount - 2 - i) * codeLen + offset);
            }

            ++calledTokenCount;
        }

        if(calledTokenCount < 1)
        {
            buffer.put(RegexVmInstruction.rts);
        }

        this._mergeAllTokenSubRoutines(buffer);

        return buffer;
    };

    /**
     *  @param {InstructionBuffer} buffer
     *  @param {AstNode} node
     *  @param {Array.<Number>} staticArgs
     *  @returns {InstructionBuffer}
     */
    CodeEmitter.prototype._visitAccept = function (buffer, node, staticArgs)
    {
        var tokenKey = staticArgs[0];

        this._createTokenSubRoutine(node, tokenKey);

        buffer.put(RegexVmInstruction.jsr, 0.2, tokenKey);
        buffer.put(RegexVmInstruction.accept, tokenKey);
        buffer.put(RegexVmInstruction.rts);

        return buffer;
    };

    /**
     *  @param {InstructionBuffer} buffer
     *  @param {AstNode} node
     *  @param {Array.<Number>} staticArgs
     *  @returns {InstructionBuffer}
     */
    CodeEmitter.prototype._visitTokenExpressionCall = function (buffer, node, staticArgs)
    {
        node;

        buffer.put(RegexVmInstruction.jsr, 0.2, staticArgs[0]);

        return buffer;
    };

    /**
     *  @param {InstructionBuffer} buffer
     *  @param {AstNode} node
     *  @returns {InstructionBuffer}
     */
    CodeEmitter.prototype._visitAlternation = function (buffer, node)
    {
        var offsetInfo = this._caculateSumOfChildCodeOffset(node);
        var offset = offsetInfo.sum;
        var childCount = node.getChildCount();
        var codeLen = 2;
        for(var i = 0; i < childCount - 1; ++i)
        {
            offset -= offsetInfo.lengths[i];

            buffer.put(RegexVmInstruction.pfork, 0, offsetInfo.lengths[i] + 1);
            buffer.consume(this._getAndWrapChildCode(node, i));
            buffer.put(RegexVmInstruction.bra, (childCount - 2 - i) * codeLen + offset);
        }
        if(i < childCount)
        {
            buffer.consume(this._getAndWrapChildCode(node, i));
        }

        return buffer;
    };

    /**
     *  @param {InstructionBuffer} buffer
     *  @param {AstNode} node
     *  @returns {InstructionBuffer}
     */
    CodeEmitter.prototype._visitConcatenation = function (buffer, node)
    {
        var childCount = node.getChildCount();
        for(var i = 0; i < childCount; ++i)
        {
            buffer.consume(this._getAndWrapChildCode(node, i));
        }

        return buffer;
    };

    /**
     *  @param {InstructionBuffer} buffer
     *  @param {AstNode} node
     *  @param {Array.<Number>} staticArgs
     *  @returns {InstructionBuffer}
     */
    CodeEmitter.prototype._visitRepetition = function (buffer, node, staticArgs)
    {
        var i = 0;

        var repType = staticArgs[0];
        var repRange = staticArgs[1];

        var childNode = node.getChildAt(0);
        var childCode = this._nodeCodeMap.get(childNode);

        var minRep = repRange.getMinimum();
        switch(minRep)
        {
        case 0:
            break;
        case 1:
            buffer.add(childCode);
            break;
        default:
            // TODO : A stub.
            // Should be optimized by using repetition bytecodes if possible.
            for(i = 0; i < minRep; ++i)
            {
                buffer.add(childCode);
            }
        }

        var childCodeLen = childCode.getCount();
        var isNonGreedy = repType === 2;
        var maxRep = repRange.getMaximum();
        if(maxRep >= _maxInt)
        {
            if(isNonGreedy)
            {
                buffer.put(RegexVmInstruction.pfork, childCodeLen + 1, 0);
            }
            else
            {
                buffer.put(RegexVmInstruction.pfork, 0, childCodeLen + 1);
            }

            buffer.consume(childCode);

            buffer.put(RegexVmInstruction.bra, -(childCodeLen + 2));
        }
        else if(minRep !== maxRep)
        {
            var optRepCount = repRange.getMaximum() - repRange.getMinimum();

            // TODO : A stub.
            // Should be optimized by using repetition bytecodes if possible.
            for(i = 0; i < optRepCount; ++i)
            {
                if(isNonGreedy)
                {
                    buffer.put(RegexVmInstruction.pfork, childCodeLen, 0);
                }
                else
                {
                    buffer.put(RegexVmInstruction.pfork, 0, childCodeLen);
                }

                if(i < optRepCount - 1)
                {
                    buffer.add(childCode);
                }
                else
                {
                    buffer.consume(childCode);
                }
            }
        }

        return buffer;
    };

    /**
     *  @param {InstructionBuffer} buffer
     *  @param {AstNode} node
     *  @returns {InstructionBuffer}
     */
    CodeEmitter.prototype._visitTerminal = function (buffer, node)
    {
        var ranges = node.getValue();

        var range = null;
        switch(ranges.length)
        {
        case 0:
            throw new Error("A list of terminal input range must have at least 1 range.");
        //break;
        case 1:
            range = ranges[0];
            if(range.getMinimum() === range.getMaximum())
            {
                buffer.put(
                    RegexVmInstruction.testCode,
                    range.getMinimum()
                );
            }
            else
            {
                this._ranges.add(range);
                buffer.put(
                    RegexVmInstruction.testRange,
                    this._ranges.indexOf(range)
                );
            }
            break;
        default:
            var rangeSet = [];
            for(var i = 0; i < ranges.length; ++i)
            {
                range = ranges[i];
                this._ranges.add(range);
                var rangeNdx = this._ranges.indexOf(range);
                rangeSet.push(rangeNdx);
            }

            this._rangeIndexSets.add(rangeSet);
            buffer.put(
                RegexVmInstruction.testRanges,
                this._rangeIndexSets.indexOf(rangeSet)
            );
        }

        return buffer;
    };

    /**
     *  @param {AstNode} node
     *  @param {number} tokenKey
     *  @returns {number}
     */
    CodeEmitter.prototype._createTokenSubRoutine = function (node, tokenKey)
    {
        var buffer = new InstructionBuffer(this._byteOrderReversed);

        var srNdx = this._tokenSrBuffers.length;

        buffer.put(RegexVmInstruction.beginGroup, 0);
        buffer.consume(this._getAndWrapChildCode(node, 0));
        buffer.put(RegexVmInstruction.endGroup, 0);

        this._labelGroups(buffer);

        buffer.put(RegexVmInstruction.consume);
        buffer.put(RegexVmInstruction.rts);

        this._tokenSrBuffers.push(buffer);

        this._tokenKeySrNdxMap.set(tokenKey, srNdx);

        return srNdx;
    };

    /**
     *  @param {InstructionBuffer} buffer
     */
    CodeEmitter.prototype._mergeAllTokenSubRoutines = function (buffer)
    {
        var i = 0;

        var offset = buffer.getCount();
        var tokenSrAddrs = [];
        for(i = 0; i < this._tokenSrBuffers.length; ++i)
        {
            var tokenSrBuffer = this._tokenSrBuffers[i];
            var tokenSrLineCount = tokenSrBuffer.getCount();

            tokenSrAddrs.push(offset);
            buffer.consume(tokenSrBuffer);

            offset += tokenSrLineCount;
        }
        this._tokenSrBuffers.length = 0;

        var jsrOpCode = RegexVmInstruction.jsr.getOpCode();
        for(i = 0; i < buffer.getCount(); ++i)
        {
            var line = buffer.getLineAt(i);
            if(line[0] === jsrOpCode && line[1] === 0.2)
            {
                line[1] = tokenSrAddrs[this._tokenKeySrNdxMap.get(line[2])];
                line.pop();
            }
        }
    };

    /**
     *  @param {AstNode} parentNode
     *  @param {number} childIndex
     *  @returns {InstructionBuffer}
     */
    CodeEmitter.prototype._getAndWrapChildCode = function (parentNode, childIndex)
    {
        var childNode = parentNode.getChildAt(childIndex);
        var childCode = this._nodeCodeMap.get(childNode);

        //this._fillLabelAddress(childCode, childCode.getCount(), 0.1);
        //        if(childNode.isRootOfGroup()) {
        //            this._wrapWithGroupBoundary(childCode);
        //        }

        return childCode;
    };

    /**
     *  @param {InstructionBuffer} buffer
     *  @param {number} labelAddress
     *  @param {number} placeholderValue
     *  @param {number} [epsilon]
     *  @returns {InstructionBuffer}
     */
    CodeEmitter.prototype._fillLabelAddress = function (
        buffer,
        labelAddress,
        placeholderValue
    )
    {
        var epsilon = arguments[3];
        if(isUndefined(epsilon))
        {
            epsilon = _epsilon;
        }

        for(var i = 0, lineCount = buffer.getCount(); i < lineCount; ++i)
        {
            --labelAddress;

            var line = buffer.getLineAt(i);

            //함수 마지막 부분으로 점프하는 모든 레이블 조사
            var inst = RegexVm.findInstructionByOpCode(line[0]);
            for(var j = 0; j < inst.getOperandCount(); ++j)
            {
                var param = line[j + 1];
                if(
                    inst.getOperandTypeAt(j) === RegexVm.OperandType.offset
                    && !isNonNegativeSafeInteger(param)
                    && relativelyEquals(param, placeholderValue, epsilon)
                )
                {
                    line[j + 1] = labelAddress;
                }
            }
        }

        return buffer;
    };

    /**
     *  @param {InstructionBuffer} buffer
     *  @returns {InstructionBuffer}
     */
    CodeEmitter.prototype._wrapWithGroupBoundary = function (buffer)
    {
        buffer.putFront(RegexVmInstruction.beginGroup, 0);
        buffer.put(RegexVmInstruction.endGroup, 0);

        return buffer;
    };

    /**
     *  @param {InstructionBuffer} buffer
     *  @returns {InstructionBuffer}
     */
    CodeEmitter.prototype._labelGroups = function (buffer)
    {
        var startIndex = 0;

        var beginGroupOpCode = RegexVmInstruction.beginGroup.getOpCode();
        var endGroupOpCode = RegexVmInstruction.endGroup.getOpCode();

        var lineCount = buffer.getCount();
        var groupIndex = startIndex;

        var groupIndexStack = [];
        for(var i = 0; i < lineCount; ++i)
        {
            var line = buffer.getLineAt(i);

            switch(line[0])
            {
            case beginGroupOpCode:
                groupIndexStack.push(groupIndex);
                line[1] = groupIndex;
                ++groupIndex;
                break;
            case endGroupOpCode:
                if(groupIndexStack.length < 1)
                {
                    throw new Error("Some group pairs lack an open or close parenthesis.");
                }
                line[1] = groupIndexStack.pop();
                break;
            }
        }

        if(groupIndexStack.length > 0)
        {
            throw new Error("Some group pairs lack an open or close parenthesis.");
        }

        return buffer;
    };

    /**
     *  @param {AstNode} node
     *  @returns {Object}
     */
    CodeEmitter.prototype._caculateSumOfChildCodeOffset = function (node)
    {
        var childCodeLens = [];
        var sumOfOffset = 0;
        for(var i = 0, childCount = node.getChildCount(); i < childCount; ++i)
        {
            var len = this._nodeCodeMap.get(node.getChildAt(i)).getCount();
            childCodeLens.push(len);
            sumOfOffset += len;
        }

        return ({
            sum : sumOfOffset,
            lengths : childCodeLens
        });
    };

    /**
     *  @param {number[]} codes
     */
    function charCodesToString(codes)
    {
        return codes.reduce(
            function (str, code)
            {
                return str + String.fromCharCode(code);
            },
            ""
        );
    }

    /**
     *  @param {string} str
     */
    function stringToCharCodes(str)
    {
        /**  @type {number[]} */var codes = new Array(str.length);
        for(var i = 0; i < str.length; ++i)
        {
            codes[i] = str.charCodeAt(i);
        }

        return codes;
    }

    return {
        OperatorType : OperatorType,
        OperatorTypeKeys : OperatorTypeKeys,
        Operator : Operator,
        AstNode : AstNode,
        RegexParser : RegexParser,
        CodeEmitter : CodeEmitter
    };
})();
