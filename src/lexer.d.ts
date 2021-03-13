import { MatchResult } from "./match-result";

export declare class LexerTokenDefinition
{
    /**
     *  @override
     */
    public toString() : string;
}

export declare class LexerToken
{
    public readonly key : number;

    public readonly name : string;

    public readonly regexText : string;

    public readonly subRoutineOnly : boolean;
}

export declare class Lexer
{
    public getToken(
        key : number
    ) : LexerToken | null;

    public getToken(
        name : string
    ) : LexerToken | null;

    public setInput(
        str : string
    ) : void;

    public scanNext(
        callback : (
            matchResult : MatchResult,
            scannedTokenCount : number,
            lexer : Lexer
        ) => void
    ) : boolean;

    public rewind() : void;
}

export declare class LexerGenerator
{
    public constructor();

    public getTokenCount() : number;

    public getTokenDefinition(
        name : string
    ) : LexerTokenDefinition;

    /**
     *  @returns The key of token definition.
     */
    public defineToken(
        name : string,
        regexText : string,
        subRoutineOnly? : boolean
    ) : number;

    public undefineToken(
        name : string
    ) : boolean;

    public undefineAllTokens() : void;

    public generate() : Lexer;
}
