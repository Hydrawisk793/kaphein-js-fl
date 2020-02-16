var LexerGenerator = require("../src").LexerGenerator;

// 2017-07-13
var lg = new LexerGenerator();
lg.defineToken("kw-private", "private");
lg.defineToken("kw-protected", "protected");
lg.defineToken("kw-public", "public");
lg.defineToken("kw-extends", "extends");
lg.defineToken("kw-final", "final");

lg.defineToken("kw-var", "var");
lg.defineToken("kw-const", "const");
lg.defineToken("kw-alias", "alias");

lg.defineToken("kw-new", "new");
lg.defineToken("kw-delete", "delete");

lg.defineToken("kw-object", "object");
lg.defineToken("kw-function", "function");

lg.defineToken("kw-if", "if");
lg.defineToken("kw-else", "else");
lg.defineToken("kw-switch", "switch");
lg.defineToken("kw-case", "case");
lg.defineToken("kw-default", "default");

lg.defineToken("kw-for", "for");
lg.defineToken("kw-do", "do");
lg.defineToken("kw-while", "while");

lg.defineToken("kw-break", "break");
lg.defineToken("kw-continue", "continue");
lg.defineToken("kw-return", "return");
lg.defineToken("kw-yield", "yield");
lg.defineToken("kw-throw", "throw");

lg.defineToken("kw-true", "true");
lg.defineToken("kw-false", "false");
lg.defineToken("kw-null", "null");

lg.defineToken("id", "[A-Za-z_$][A-Za-z0-9_$]*");
lg.defineToken("lit-str", "\".*?\"");
lg.defineToken("lit-base10-int", "(\\+|\\-)?(0|[1-9][0-9]*)");

lg.defineToken("group-begin", "\\(");
lg.defineToken("group-end", "\\)");
lg.defineToken("block-begin", "\\{");
lg.defineToken("block-end", "\\}");
lg.defineToken("end-of-stmt", ";");

lg.defineToken("op-dot", "\\.");
lg.defineToken("op-spread", "\\.{3}");
lg.defineToken("op-colon", ":");
lg.defineToken("op-comma", ",");
lg.defineToken("op-eq", "==");
lg.defineToken("op-ne", "!=");
lg.defineToken("op-ge", ">=");
lg.defineToken("op-gt", ">");
lg.defineToken("op-le", "<=");
lg.defineToken("op-lt", "<");
lg.defineToken("op-assign", "=");
lg.defineToken("op-add-assign", "\\+=");
lg.defineToken("op-sub-assign", "\\-=");
lg.defineToken("op-mul-assign", "\\*=");
lg.defineToken("op-div-assign", "\\/=");
lg.defineToken("op-mod-assign", "%=");
lg.defineToken("op-inc", "\\+{2}");
lg.defineToken("op-dec", "\\-{2}");
lg.defineToken("op-add", "\\+");
lg.defineToken("op-sub", "\\-");
lg.defineToken("op-mul", "\\*");
lg.defineToken("op-div", "\\/");
lg.defineToken("op-mod", "\\%");

var lexer = lg.generate();
lexer.setInput(
    "var fooFunc = function (arg0, ...) {"
    + "    var fooBarBaz = \"quxQuxQuxquxuqx\""
    + "    var ifObjWorks = object extends global.Array {"
    + "        public foo = -2343;"
    + "        private bar_ = \"should not visible.\";"
    + "    };"
    + "    if(true) {"
    + "        return false;"
    + "    }"
    + "    else {"
    + "        var nullablePtr = null;"
    + "        var $qux = 23525;"
    + "        return $qux + 53 * (77 - 34);"
    + "    }"
    + "}"
);

var resultStr = "";//lexer._regexVm._bytecode._sourceCodeForDebug;
console.log(resultStr);

while(
    lexer.scanNext(
        function (matchResult, index, lexer)
        {
            resultStr += index + " : " + lexer.getToken(matchResult.tokenKey).name + ", " + matchResult + "\r\n";
        }
    )
);

console.log(resultStr);
