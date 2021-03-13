const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const nodeExternals = require("webpack-node-externals");

module.exports = (function ()
{
    var outputDirectoryName = "dist";

    return {
        entry : path.resolve(__dirname, "src", "index.js"),
        target : "web",
        output : {
            filename : "index.js",
            path : path.resolve(__dirname, outputDirectoryName),
            library : "kapheinJsFl",
            libraryTarget : "umd",
            globalObject : "this"
        },
        plugins : [
            new CopyWebpackPlugin({
                patterns : [
                    {
                        context : "src",
                        from : "**/*.d.ts",
                        to : ""
                    }
                ]
            }),
        ],
        module : {

        },
        externals : [
            nodeExternals()
        ],
        resolve : {
            modules : ["node_modules"]
        }
    };
})();
