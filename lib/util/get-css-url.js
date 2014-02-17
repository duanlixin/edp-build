/**
 * @file 返回css内容中，url地址的数组
 * @author duanlixin[duanlixin@gmail.com]
 * 
 * @param {string} content 内容
 * @return {array} url地址的数组
 */

module.exports = exports = function ( content ) {

    var pattern = 'url[\(]([\'"]?)([^\'"\)]+)\\1[\)]';
    var globalReg = new RegExp( pattern , 'g' );
    var localReg = new RegExp( pattern );
    var result = [];

    var matchs = content.match( globalReg ) || [];
    matchs.forEach( function ( url ) {
        var matchArray = url.match( localReg ) || [];
        matchArray[ 2 ] && result.push( matchArray[ 2 ] );
    } );

    return result;
};
