import { Interval } from "kaphein-js-math";

export declare class MatchResult
{
    public constructor(
        tokenKey : number,
        text : string,
        range : Interval
    );

    public get tokenKey() : number;

    public get text() : string;

    public get range() : Interval;

    public equals(
        other : any
    ) : boolean;

    /**
     *  @override
     */
    public toString() : string;
}
