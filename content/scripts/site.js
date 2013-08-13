var debug = new DebugController({ el: '#debug-information' });
var home = new HomeController({ el: '#home' });
var player = new PlayerController({ el: '#player-setup' });
var application = new ApplicationController({ el: '#application-setup' });

var tabs = new Spine.Tabs({el: '.tabs'});
tabs.connect('home', home);
tabs.connect('player-setup', player);
tabs.connect('application-setup', application);
tabs.connect('debug-information', debug);
// Perform all model loads, fetch in reverse relation
// Application Data
URLModel.fetch();
BetModel.fetch();
// Race Data
HorseModel.fetch();
RaceModel.fetch();
DateModel.fetch();
// Player Data
FundModel.fetch();
PlayerModel.fetch();
// render tab
tabs.render();
RaceModel.trigger("refresh");

$("div.alert").live("click", function() {
    $(this).slideUp();
});