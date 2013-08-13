/**
 * jQuery.ajax mid - CROSS DOMAIN AJAX 
 * ---
 * @author James Padolsey (http://james.padolsey.com)
 * @version 0.11
 * @updated 12-JAN-10
 * ---
 * Note: Read the README!
 * ---
 * @info http://james.padolsey.com/javascript/cross-domain-requests-with-jquery/
 */

jQuery.ajax = (function(_ajax){
    
    var protocol = location.protocol,
        hostname = location.hostname,
        path = '*',
        exRegex = RegExp(protocol + '//' + hostname),
        YQL = 'http' + (/^https/.test(protocol)?'s':'') + '://query.yahooapis.com/v1/public/yql?callback=?',
        query = 'select * from html where url="{URL}" and xpath="{PATH}"';
    
    function isExternal(url) {
        return !exRegex.test(url) && /:\/\//.test(url);
    }
    
    function selectorToXPath(rule)
    {
        var regElement = /^([#.]?)([a-z0-9\\*_-]*)((\|)([a-z0-9\\*_-]*))?/i;
        var regAttr1 = /^\[([^\]]*)\]/i;
        var regAttr2 = /^\[\s*([^~=\s]+)\s*(~?=)\s*"([^"]+)"\s*\]/i;
        var regPseudo = /^:([a-z_-])+/i;
        var regCombinator = /^(\s*[>+\s])?/i;
        var regComma = /^\s*,/i;

        var index = 1;
        var parts = ["//", "*"];
        var lastRule = null;
        
        while (rule.length && rule != lastRule)
        {
            lastRule = rule;

            // Trim leading whitespace
            rule = rule.replace(/^\s*|\s*$/g,"");
            if (!rule.length)
                break;
            
            // Match the element identifier
            var m = regElement.exec(rule);
            if (m)
            {
                if (!m[1])
                {
                    // XXXjoe Namespace ignored for now
                    if (m[5])
                        parts[index] = m[5];
                    else
                        parts[index] = m[2];
                }
                else if (m[1] == '#')
                    parts.push("[@id='" + m[2] + "']"); 
                else if (m[1] == '.')
                    parts.push("[contains(@class, '" + m[2] + "')]"); 
                
                rule = rule.substr(m[0].length);
            }
            
            // Match attribute selectors
            m = regAttr2.exec(rule);
            if (m)
            {
                if (m[2] == "~=")
                    parts.push("[contains(@" + m[1] + ", '" + m[3] + "')]");
                else
                    parts.push("[@" + m[1] + "='" + m[3] + "']");

                rule = rule.substr(m[0].length);
            }
            else
            {
                m = regAttr1.exec(rule);
                if (m)
                {
                    parts.push("[@" + m[1] + "]");
                    rule = rule.substr(m[0].length);
                }
            }
            
            // Skip over pseudo-classes and pseudo-elements, which are of no use to us
            m = regPseudo.exec(rule);
            while (m)
            {
                rule = rule.substr(m[0].length);
                m = regPseudo.exec(rule);
            }
            
            // Match combinators
            m = regCombinator.exec(rule);
            if (m && m[0].length)
            {
                if (m[0].indexOf(">") != -1)
                    parts.push("/");
                else if (m[0].indexOf("+") != -1)
                    parts.push("/following-sibling::");
                else
                    parts.push("//");

                index = parts.length;
                parts.push("*");
                rule = rule.substr(m[0].length);
            }
            
            m = regComma.exec(rule);
            if (m)
            {
                parts.push(" | ", "//", "*");
                index = parts.length-1;
                rule = rule.substr(m[0].length);
                
            }
        }
        
        var xpath = parts.join("");
        return xpath;
    }

    return function(o) {
        
        var url = o.url;
        
        if ( /get/i.test(o.type) && !/json/i.test(o.dataType) && isExternal(url) ) {
            
            // Manipulate options so that JSONP-x request is made to YQL
            
            o.url = YQL;
            o.dataType = 'json';
            
            o.data = {
                q: query.replace(
                    '{URL}',
                    url + (o.data ?
                        (/\?/.test(url) ? '&' : '?') + jQuery.param(o.data)
                    : '')
                ).replace(
                    '{PATH}',
                    selectorToXPath(o.path || path)
                ),
                format: 'xml'
            };
            
            // Since it's a JSONP request
            // complete === success
            if (!o.success && o.complete) {
                o.success = o.complete;
                delete o.complete;
            }
            
            o.success = (function(_success){
                return function(data) {
                    
                    if (_success) {
                        // Fake XHR callback.
                        _success.call(this, {
                            results: data.results
                        }, 'success');
                    }
                    
                };
            })(o.success);
            
        }
        
        return _ajax.apply(this, arguments);
        
    };
    
})(jQuery.ajax);