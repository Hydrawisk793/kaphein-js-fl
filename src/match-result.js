module.exports = (function ()
{
    /**
     *  @typedef {import("kaphein-js-math").Interval} Interval
     */

    /**
     *  @constructor
     *  @param {number} tokenKey
     *  @param {string} text
     *  @param {Interval} range
     */
    function MatchResult(tokenKey, text, range)
    {
        this.tokenKey = tokenKey;
        this.text = text;
        this.range = range;
    }

    MatchResult.prototype = {
        constructor : MatchResult,

        equals : function equals(rhs)
        {
            var result = this === rhs;
            if(!result) {
                result = rhs instanceof MatchResult
                    && this.tokenKey === rhs.tokenKey
                    && this.text === rhs.text
                    && this.range.equals(rhs.range)
                ;
            }
        },

        toString : function toString()
        {
            var str = '{';

            str += "tokenKey";
            str += " : ";
            str += this.tokenKey;

            str += ", ";
            str += "text";
            str += " : ";
            str += "\"" + this.text + "\"";

            str += ", ";
            str += "range";
            str += " : ";
            str += this.range;

            str += '}';

            return str;
        }
    };

    return {
        MatchResult : MatchResult
    };
})();
