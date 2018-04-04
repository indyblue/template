'use strict';

if (!Element.prototype.matches) {
    Element.prototype.matches = Element.prototype.msMatchesSelector;
}

/* 
// this method of wrapping the callback makes it nearly impossible 
// to use removeEventListener. Should I create an array?
Element.prototype.on = function(event, filter, cb) {
    if(typeof filter === 'function') {
        cb = filter;
        filter = undefined;
    }
    var cbw = cb;
    if(filter!==undefined) cbw = function() {
        if(!this.matches(filter)) return;
        cb.apply(this, arguments);
    }
    this.addEventListener(event, cbw);
};
*/