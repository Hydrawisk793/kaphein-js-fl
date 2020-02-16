var LexerGenerator = require("./lexer.").LexerGenerator;

module.exports = (function ()
{
    /*////////////////////////////////*/
    //LrParser

    function LrParser()
    {

    }

    /*////////////////////////////////*/

    /*////////////////////////////////*/
    //LrParserGenerator

    // function GrammarSyntax() {
    //     this._symbolNdxes = [];
    // }

    // function GrammarRule() {
    //     this._nonTermNdx = 0;
    //     this._syntaxes = [];
    // }

    // function LrItem() {
    //     this._ruleNdx = 0;
    //     this._lookaheadNdxes = [];
    // }

    /**
     *  @constructor
     */
    function LrParserGenerator()
    {
        this._lg = new LexerGenerator();
    }

    /**
     *  @function
     *  @param {string} name
     *  @param {String|Array.<String>} syntaxArg
     *  @param {boolean} [overwrite=false]
     */
    // eslint-disable-next-line no-unused-vars
    LrParserGenerator.prototype.addRule = function (name, syntaxArg) {

    };

    /**
     *  @function
     *  @returns {karbonator.string.LrParser|null}
     */
    LrParserGenerator.prototype.generate = function () {

    };

    return {
        LrParser : LrParser,
        LrParserGenerator : LrParserGenerator
    };
})();
