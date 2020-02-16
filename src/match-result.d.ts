import { Interval } from "kaphein-js-math";

export declare class MatchResult
{
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
