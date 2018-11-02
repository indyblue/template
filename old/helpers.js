'use strict';

if (!Element.prototype.matches) {
    Element.prototype.matches = Element.prototype.msMatchesSelector;
}

(function() {
	var qfetch = window.fetch;
	window.fetch = function() {
		var fargs = arguments;
		return qfetch.apply(window, arguments).then(function(resp) {
			console.log(fargs, resp);
			if(resp.clone) resp.clone().text().then(t=> {
				console.log(t.substr(0,200));
			});
			return resp;
		});
	};
})();

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

			ajaxCallback = function(callback){
				XMLHttpRequest.qwerCallback = callback;
				
				if(XMLHttpRequest.prototype.addSpy===true) return;
				XMLHttpRequest.prototype.addSpy = true;
				var oldSend = XMLHttpRequest.prototype.send;
				XMLHttpRequest.prototype.send = function(data){
					this.qwerData = data;
					return oldSend.apply(this, arguments);
				}
				var oldOpen = XMLHttpRequest.prototype.open;
				XMLHttpRequest.prototype.open = function(method, url){
					var retval = oldOpen.apply(this, arguments);
					XMLHttpRequest.qwerCallback(this, method, url );
					return retval;
				}
			}
			
			ajaxCallback(function(xhr, method, url){
					console.log('one', method, url, xhr.qwerData);
				if(!(url==="/svc/rr/accounts/secure/v1/account/activity/card/list")) return;
				let rsc = xhr.onreadystatechange;
				xhr.onreadystatechange = function(e) {
					if(typeof rsc==='function') rsc.apply(this, arguments);
					console.log('two', method, url, xhr.qwerData);
					if(xhr.readyState===4 && xhr.response!==''
						&& /statementPeriodId=ALL/.test(xhr.qwerData) ) {
						var data = JSON.parse(xhr.response)
						console.log('readystate');
						r(data);
					}
				}
			});


*/
