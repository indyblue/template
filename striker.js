'use strict';
function Striker() {
    var t = this, sTemplate = 'data-template', rxSplit = /[.\[\]]+/g,
        rxPat = /{{\s*([^ \t}]+)\s*}}/ig, rxRep = /^data-repeat-([^-]+)-?.*$/;

    t.exec = function (e, data, removeParent) {
        if ((e = elCheck(e)) === undefined) return;
        var e2 = e.cloneNode(true);
        traverse(e2, data);
        if (removeParent) return e2.childNodes;
        else return e2;
    };
    t.append = function (eParent, eChildren) {
        if (!eChildren.length) eChildren = [eChildren];
        while (eChildren.length>0) eParent.appendChild(eChildren[0]);
    };
    t.expend = function(eParent, e, data, removeParent){
        var e2 = t.exec(e, data, removeParent);
        t.append(eParent, e2);
    };

    function traverse(e, data) {
        var tmpName = null, pat = null, rarray = null, rname, rdata, tmpName;
        if ((e = elCheck(e)) === undefined) return;
        if (e.nodeName === '#text') {
            var cb = cbPat.bind(e.parentNode, data, '>');
            e.nodeValue = e.nodeValue.replace(rxPat, cb);
        }

        if (e.attributes) for (var i = 0; i < e.attributes.length; i++) {
            var a = e.attributes[i];
            if (a.name === sTemplate) tmpName = a.value;
            else if ((pat = rxRep.exec(a.name)) !== null) {
                rname = pat[1];
                rarray = cbPat(data, '>', '', a.value);
            } else {
                var cb = cbPat.bind(e, data, a.name);
                a.value = a.value.replace(rxPat, cb);
            }
        }

        if (rarray && rarray.length) {
            if (tmpName === null) {
                tmpName = e.cloneNode(true);
                while(tmpName.attributes.length>0) 
                    tmpName.removeAttribute(tmpName.attributes[0].name);
            }
            e.innerHTML = '';
            for (var i = 0; i < rarray.length; i++) {
                (rdata = { '^': data })[rname] = rarray[i];
                t.expend(e, tmpName, rdata, true);
            }
        } else {
            if (tmpName !== null) t.expend(e, tmpName, data, true);
            else for (var i = 0; i < e.childNodes.length; i++)
                traverse(e.childNodes[i], data);
        }
    }
    function cbPat(data, name, all, path) {
        if (typeof path === 'string') path = path.split(rxSplit);
        var e = this, o = data;
        for (var i = 0; i < path.length; i++) {
            var p = path[i];
            if (o[p] !== undefined) o = o[p];
            else {
                console.warn('path "' + path.join('.') + '" not found in data');
                return '';
            }
        }
        if (name !== '>' && typeof o === 'function' && isElement(e)) {
            e.attributes.removeNamedItem(name);
            delete e[name];
            e.addEventListener(name.replace(/^on-?/i,''), o.bind(e, data));
            o = '';
        }
        return o;
    }

    function elCheck(el) {
        if (typeof el === 'string') el = document.querySelector(el);
        if (!isElement(el) && !isDocFrag(el) && !isText(el)) return undefined;
        if (el.content) el = el.content;
        return el;
    };
    function isElement(obj) { return obj instanceof Element; }
    function isText(obj) { return obj instanceof Text; }
    function isDocFrag(obj) { return obj instanceof DocumentFragment; }
}