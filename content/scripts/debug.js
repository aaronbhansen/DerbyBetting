var DebugController = TabController.create({
    logPrefix: 'Debug',

    elements: {
        "ul[data-el=debug-history]" : "ulEl"
    },

    init: function() {
        window.console.log = this.proxy(this.logToScreen);
    },

    logToScreen: function(prefix) {
        var args = Array.prototype.slice.call(arguments);
        args.shift();

        var li = $("<li>");
        li.html(FormatTime(new Date()) + " | " + prefix + ": " + args.join());
        this.ulEl.append(li);
    }
});