/**
 * @file manifest的构建处理器
 * @author duanlixin[duanlixin@gmail.com]
 */

var AbstractProcessor = require( './abstract' );
var pathSatisfy = require( '../util/path-satisfy' );
var path = require( '../util/path' );

/**
 * manifest的构建处理器
 *
 * @constructor
 * @param {Object} options 初始化参数
 */
function ManifestCompiler( options ) {
    AbstractProcessor.call( this, options );

    this.manifests = this.manifests || [];
    this.fileCount = 0;
    this.fileIndex = 0;
    this.configFile = this.configFile || 'module.conf';
    // manifest数据对象
    var manifestInfo = this.manifestInfo = {};
    // manifest数据对象设置初值
    this.manifests.forEach( function ( option ) {
        // 按manifest文件名，存入信息
        manifestInfo[ option.cachePage ] = {
            cachePage: option.cachePage,
            autoCache: option.autoCache == false ? false: true,
            prefixPath: option.prefixPath,
            relativePath: null,
            fullPath: null,

            manifestName: option.manifestName,
            version: null,
            cache: option.cache || [],
            fallback: option.fallback || [],
            network: option.network || [],
            html: [],
            image: [],
            css: [],
            cssurl: [],
            script: [],
            module: []
        };
    } );
}


ManifestCompiler.prototype = new AbstractProcessor();

/**
 * 处理器名称
 *
 * @type {string}
 */
ManifestCompiler.prototype.name = 'ManifestCompiler';

/**
 * 构建处理
 *
 * @param {FileInfo} file 文件信息对象
 * @param {ProcessContext} processContext 构建环境对象
 * @param {Function} callback 处理完成回调函数
 */
ManifestCompiler.prototype.process = function ( file, processContext, callback ) {
    var _this = this;
    var manifestInfo = _this.manifestInfo;
    var files = processContext.getFiles();

    if ( !this.fileCount ) {
        this.fileCount = files.length;
    }

    this.fileIndex++;
    // 在遍历所有文件后:  给入口文件增加manifest属性和生成manifest文件
     if ( this.fileIndex === this.fileCount ) {
        // 遍历文件
        files.forEach( function ( file ) {
            // 遍历配置
            _this.manifests.forEach( function ( manifest, index ) {
                var cachePage = manifest.cachePage;
                // 判断路径片段是否满足规则
                if ( pathSatisfy( file.path, cachePage ) ) {

                    // 缓存页面目录路径，manifest文件与缓存页面在相同目录下
                    var fileDir = path.dirname( file.fullPath );
                    var fullPath = path.resolve( 
                        fileDir, 
                        manifest.manifestName 
                    );
                    var baseDir = processContext.baseDir;
                    var relativePath = path.relative( baseDir , fullPath );
                    var manifestData = manifestInfo[ cachePage ];

                    manifestData.version = +new Date().getTime();
                    manifestData.relativePath = relativePath;
                    manifestData.fullPath = fullPath;

                    if ( manifestData.autoCache === true ) {
                        var resource = getResource( 
                            processContext, 
                            file, 
                            _this.configFile 
                        );
                        for( var resType in resource ) {
                            var value = resource[ resType ];
                            manifestData[ resType ] = value;
                        }
                    }

                    var content = getCachePage( 
                        file.data, 
                        manifest.manifestName 
                    );
                    // 给入口页面加入manifest属性
                    file.setData( content );
                    // 文件完全匹配时，在配置中删除当前manifest
                    // 防止与路径匹配时重复
                    if( file.path == cachePage ) {
                        _this.manifests.splice( index, 1 );
                    }
                }
            } );
        } );
        // 给processContext中加入manifest文件对象
        for ( var key in manifestInfo ) {

            var manifest = manifestInfo[ key ];
            addFileToProcessContext( processContext, manifest.fullPath );
            setResources( processContext, manifest.relativePath, manifest );
        }
    }

    callback();
};

/**
 * 返回缓存资源:html、css、image、script标签、require的模块id的全路径
 * 
 * @inner
 * @param {ProcessContext} processContext 构建环境对象
 * @param {FileInfo} file 文件信息对象
 * @param {string} configFile module配置文件
 * @return {object} 缓存资源对象
 */
function getResource( processContext, file, configFile ) {
    var content = file.data;
    // 获取模块id数组
    var moduleIds = getModuleIds( content );
    // module文件全路径数组
    var moduleSource = [];
    var getModuleFile = require( '../util/get-module-file' );
    moduleIds.forEach( function ( item ) {
        var moduleFullpath = getModuleFile( item , configFile );
        moduleSource.push( moduleFullpath );
    } );
    // 获取标签的属性值
    var getTagAttributes = require( '../util/get-tag-attribute' );
    var module = getModlueOutputPath( 
        processContext, 
        moduleSource 
    );
    var cssurl = getCssUrlPath(
        processContext,
        getTagAttributes( content , 'link', 'href' )
    );

    return {
        html: [ file.outputPath ],
        css: getTagAttributes( content , 'link', 'href' ),
        image: getTagAttributes( content , 'img', 'src' ),
        script: getTagAttributes( content , 'script', 'src' ),
        module: module,
        cssurl: cssurl
    };
}
/**
 * 去除数组中重复的元素
 * 
 * @inner
 * @param {array} arr 数组对象
 * @return {array} 去重后的数组对象
 */
function uniqueArray( arr ) {
    var result = [];

    arr.forEach( function ( item ) {
        if ( result.indexOf( item, result ) === -1 ) {
            result.push( item );
        }
    } );

    return result;
}
/**
 * 给数组中的路径增加前缀
 * 
 * @inner
 * @param {array} arr 发布路径数组
 * @param {string} prefixPath 路径前缀
 * @return {array} 返回增加前缀后的路径数组
 */
function addPrefixToOutputPath( arr, prefixPath ) {
    var result = [];

    if ( prefixPath ) {
        arr.forEach( function ( item ) {
            result.push( path.join( prefixPath, item ) );
        } );
    }

    return result;
}
/**
 * 返回模块文件的发布路径
 * 
 * @inner
 * @param {ProcessContext} processContext 构建环境对象
 * @param {array} module 模块文件完整路径数组
 * @return {array} 模块文件的发布路径数组
 */
function getModlueOutputPath( processContext, module ) {
    var result = [];
    var files = processContext.getFiles();

    module.forEach( function ( item ) {
        files.forEach( function ( file ) {
            if ( item == file.fullPath ) {
                result.push( file.outputPath );
            }
        } );
    } );
    return result;
}

/**
 * 返回css文件中url资源的发布地址
 * 
 * @inner
 * @param {ProcessContext} processContext 构建环境对象
 * @param {array} arr css文件发布路径数组
 * @return {array} css文件中url资源的发布地址
 */
function getCssUrlPath( processContext, css ) {
    var result = [];
    var files = processContext.getFiles();
    var baseDir = processContext.baseDir;
    
    css.forEach( function ( item ) {

        files.forEach( function ( file ) {
            if ( file && pathSatisfy( item, file.outputPath ) ) {
                var cssUrl = require( '../util/get-css-url' )( file.data );
                var dir = path.dirname( file.outputPath );
                cssUrl.forEach( function ( item ) {
                    var fullPath = path.resolve( dir , item );
                    var url = path.relative( baseDir, fullPath );

                    result.push( url );
                });
            }
        } );

    } );

    return result;
}
/**
 * 用数据对象填充模板，返回字符串
 * 
 * @inner
 * @param {string} source 模板字符串
 * @param {object} opts 数据对象
 * @return {string} 用数据对象填充的字符串
 */
function format( source, opts ) {
    source = String( source );
    return source.replace( /#\{(.+?)\}/g, function ( match, key ) {
        var replacer = opts[ key ];
        return ( 'undefined' == typeof replacer ? '' : replacer );
    });
}
/**
 * 返回缓存页面的内容(已增加manifest属性以及manifest文件路径)
 * 
 * @inner
 * @param {string} content 使用manifest页面的内容
 * @param {string} manifestName manifest的名字
 * @return {string} 缓存页面的内容(已增加manifest属性以及manifest文件路径)
 */
function getCachePage( content, manifestName ) {
    var manifest = ' manifest="' + manifestName + '" ';
    if( content ) {
        return content.replace( /<html[^>]*/g, function ( match ) {
            return match + manifest;
        });
    }
}

/**
 * 把文件信息对象加入环境对象中
 * 
 * @inner
 * @param {ProcessContext} processContext 构建环境对象
 * @param {string} fullPath 文件的全路径
 */
function addFileToProcessContext( processContext, fullPath ) {
    var relativePath = path.relative( processContext.baseDir, fullPath );
    var extname = path.extname( fullPath ).slice( 1 );
    var FileInfo = require( '../file-info' );
    var fileEncodings = processContext.fileEncodings;
    var fileEncoding = null;

    for ( var encodingPath in fileEncodings ) {
        if ( pathSatisfy( relativePath, encodingPath ) ) {
            fileEncoding = fileEncodings[ encodingPath ];
            break;
        }
    }
    
    var fileData = new FileInfo( {
        data         : '',
        extname      : extname,
        path         : relativePath,
        fullPath     : fullPath,
        stat         : {},
        fileEncoding : fileEncoding
    } );

    processContext.addFile( fileData );
}
// manifest 模板文件
var manifestTpl = [
    'CACHE MANIFEST',
    '# manifestName #{manifestName}',
    '# version  #{version}',
    'CACHE:',
    '# cache',
    '#{cache}',
    '# html files',
    '#{html}',
    '# image files',
    '#{image}',
    '# css files',
    '#{css}',
    '# cssurl files',
    '#{cssurl}',
    '# script files',
    '#{script}',
    '# module files',
    '#{module}',
    'FALLBACK:',
    '#{fallback}',
    'NETWORK:',
    '*',
    '#{network}'
].join( '\n' );
// manifest文件中的数组对象
var manifestArrayKeys = [
    'html',
    'css',
    'cssurl',
    'image',
    'script',
    'module',
    'cache',
    'fallback',
    'network'
];
// manifest文件中可能加前缀的数组对象
var prefixPathTypes = [
    'html',
    'cssurl',
    'module'
];
/**
 * 给manifest文件中加入资源
 * 
 * @inner
 * @param {ProcessContext} processContext 构建环境对象
 * @param {string} manifestName manifest文件名
 * @param {object} data manifest资源数据
 */
function setResources( processContext , manifestName, data ) {

    var manifest = processContext.getFileByPath( manifestName );

    if ( manifest ) {
        for ( var key in data ) {
            var value = data[ key ];
            if ( manifestArrayKeys.indexOf( key ) !== -1 && 
                Array.isArray( value ) ) {
                value = uniqueArray( value );
                if ( data.prefixPath && 
                    prefixPathTypes.indexOf( key ) !== -1 ) {
                    value = addPrefixToOutputPath( value, data.prefixPath );
                }
                
                data[ key ] = value.join( '\n' );
            }
        }
        var content = format( manifestTpl, data );
        manifest.setData( content );
    }
}

/**
 * 返回内容中module id数组
 * 
 * @param {string} content 内容
 * @return {array} module id数组
 */
function getModuleIds( content ) {
    
    var codeFragment = content.match( /require\s*\(\s*\[([^\]]*)\]/g ) || [];
    var result = [];
    codeFragment.forEach( function ( content ) {
        var moduleIdArray = readModuleId( content ).data;
        Array.prototype.push.apply( result, moduleIdArray );
    } );
    return result;

}
/**
 * 从内容中读取module id
 * 
 * @param {string} content 内容
 * @return {Object}
 */
function readModuleId( content ) {
    var outputInfo = {};
    var index = content.search( /(require\s*\(\s*\[)/ );
    if ( index < 0 ) {
        return;
    }

    index += RegExp.$1.length - 1;

    // 取文件内容
    outputInfo.content = content;

    // 查找require module id的开始和结束位置
    var len = content.length;
    var braceLevel = 0;
    outputInfo.fromIndex = index;
    do {
        switch ( content[ index ] ) {
            case '[': 
                braceLevel++;
                break;
            case ']':
                braceLevel--;
                break;
        }

        index++;
    } while ( braceLevel && index < len );
    outputInfo.toIndex = index;

    // 取配置数据
    content = content.slice( outputInfo.fromIndex, index );
    outputInfo.data = eval( '(' + content + ')' );

    return outputInfo;
}

module.exports = exports = ManifestCompiler;