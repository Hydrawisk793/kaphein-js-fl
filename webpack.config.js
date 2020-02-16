var path = require("path");

var CopyWebpackPlugin = require("copy-webpack-plugin");
var UglifyJsPlugin = require("uglifyjs-webpack-plugin");
var nodeExternals = require('webpack-node-externals');

module.exports = (function ()
{
    var outputDirectoryName = "dist";

    return {
        entry : path.resolve(__dirname, "src", "index.js"),
        target : "web",
        output : {
            filename : "index.js",
            path : path.resolve(__dirname, outputDirectoryName),
            library : "kapheinJs",
            libraryTarget : "umd"
        },
        optimization : {
            minimizer : [new UglifyJsPlugin()]
        },
        plugins : [
            new CopyWebpackPlugin([
                {
                    context : "src",
                    from : "**/*.d.ts",
                    to : ""
                }
            ]),
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
