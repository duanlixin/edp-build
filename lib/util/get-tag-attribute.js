/**
 * @file 返回html内容中，标签的属性值数组
 * @author duanlixin[duanlixin@gmail.com]
 * 
 * @param {string} content 内容
 * @param {string} tag 标签名
 * @param {string} attribute 属性名
 * @return {array} 标签的属性值数组
 */
module.exports = exports = function ( content , tag, attr ) {
    var attrReg = new RegExp( '(' + attr + ')=([\'"])([^\'"]+)\\2' );
    var tagReg = new RegExp( '<' + tag + '([^>]+)', 'g' );
    var result = [];

    var matchs = content.match( tagReg ) || [];
    matchs.forEach( function ( tagStr ) { 
        var matchArray = tagStr.match( attrReg ) || [];
        matchArray[ 3 ] && result.push( matchArray[ 3 ] );
    } );

    return result;
};