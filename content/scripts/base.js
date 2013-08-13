function FormatDate(date) {
	return $.format.date(date, 'MM/dd/yyyy');
}

function FormatTime(date) {
	return $.format.date(date, 'hh:mm:ss a');
}

function FormatNumber(number) {
	return parseFloat(parseFloat(number).toFixed(2));
}

function GetNumber(number) {
	number = (number + "").replace("$", "");
	number = parseFloat(number);
	if (isNaN(number)) {
		return 0;
	}
	return FormatNumber(number);
}

function getOdds(current, morning) {
	var odds = current;
	if (odds === '')
	{
		odds = morning;
	}		
	var oddsSplit = odds.split('/');
	if (oddsSplit[1] === undefined) {
		oddsSplit[1] = '1';
	}
	return parseFloat(oddsSplit[0]/oddsSplit[1]);
}

// These are just estimate functions, real calculations come from page
function calculateToWin(odds, bet) {
	var total = (odds * bet) + bet;
	return FormatNumber(total);
}

function calculateToPlace(odds, bet) {
	var newBet = bet - (bet * .15);
	var total = FormatNumber((newBet * odds)/4) + bet;
	if (total < bet) {
		return bet * 1.05; // min bet win
	}
	return total;
}

function calculateToShow(odds, bet) {
	var newBet = bet - (bet * .15);
	var total = FormatNumber((newBet * odds)/8) + bet;	
	if (total < bet) {
		return bet * 1.05; // min bet win
	}
	return total;
}

// Models
// Relations
//	URLModel
//	DateModel
//		Has RaceModel
//			Has HorseModel
//	PlayerModel
//		Has FundsModel
// 	BetModel
// 		Relation to HorseModel & PlayerModel

// Application Data
var URLModel = Spine.Model.sub();
URLModel.configure('URL', 'value');
URLModel.extend(Spine.Model.Local);

// Race Data
var DateModel = Spine.Model.sub();
DateModel.configure('Date', 'url', 'date', 'selected');
DateModel.hasMany('races', 'RaceModel');
DateModel.extend(Spine.Model.Local);

var RaceModel = Spine.Model.sub();
RaceModel.configure('Race', 'url', 'name', 'expired', 'calculated', 'selected', 'postTime', 'win', 'place', 'show', 'finished', 'calculated');
RaceModel.belongsTo('date', 'DateModel');
RaceModel.hasMany('horses', 'HorseModel');
RaceModel.extend(Spine.Model.Local);

var HorseModel = Spine.Model.sub();
HorseModel.configure('Horse', 'number', 'name', 'morningOdds', 'currentOdds', 'jockey', 'jockeyWeight', 'trainer', 'scratched', 'style');
HorseModel.belongsTo('race', 'RaceModel');
HorseModel.extend(Spine.Model.Local);

// Player Data
var PlayerModel = Spine.Model.sub();
PlayerModel.configure('Player', 'name', 'selected', 'lastBetWinnings');
PlayerModel.hasMany('funds', 'FundModel');
PlayerModel.hasMany('bets', 'BetModel');
PlayerModel.extend(Spine.Model.Local);
PlayerModel.include({
	totalFunds: function() {
		var total = 0;
		$.each(this.funds().all(), function(index, value) {
			total += value.amount;
		});
		return FormatNumber(total);
	},
	totalBet: function() {
		var total = 0;
		$.each(this.funds().all(), function(index, value) {
			if (value.type === 'Bet')
				total += value.amount;
		});
		return FormatNumber(total);
	},
	totalWon: function() {
		var total = 0;
		$.each(this.funds().all(), function(index, value) {
			if (value.type === 'Payout')
				total += value.amount;
		});
		return FormatNumber(total);
	},
	roi: function() {
		var totalBet = this.totalBet();
		var totalWon = this.totalWon();
		if (totalBet == 0)
			return 0;

		return FormatNumber(((totalWon - Math.abs(totalBet))/Math.abs(totalBet)) * 100);
	}
});

var FundModel = Spine.Model.sub();
FundModel.configure('Fund', 'date', 'action', 'amount', 'type');
FundModel.belongsTo('player', 'PlayerModel');
FundModel.extend(Spine.Model.Local);

var BetModel = Spine.Model.sub();
BetModel.configure('Bet', 'race', 'horse', 'win', 'place', 'show');
BetModel.belongsTo('player', 'PlayerModel');
BetModel.extend(Spine.Model.Local);
// Add horse relation?

// Spine Controllers
var BaseController = Spine.Controller.create({

    constructor: function() {
      BaseController.__super__.constructor.apply(this, arguments);
      this.trace("Initialized");
      this.bind("release", this.proxy(function() { this.trace("Released"); }));
    },

	showAlert: function(el, type, message, options) {
		var options = options || {};
		var success = $('<div class="alert alert-' + type + '"></div>');
		success.html(message);
		success.css('display', 'none');
		el.prepend(success);
		if (options.tag) {
			success.attr('data-tag', options.tag);
		}

		if (options.permanent) {
			success.show();
		} else {
			success.slideDown(500).delay(2000).slideUp(500);	
		}
		this.trace("Showing alert. " + (options.tag ? "Tag: '" + options.tag + "', ": "") + "Length: '" + (options.permanent ? "permanent" : "slider") + "'");
	},

	removeAlert: function(tag) {
		this.el.find('div[data-tag=' + tag + ']').remove();
	},

	trace: function() {
		if (BaseController.LogTrace)
			this.log.apply(this, arguments);
	}
});
BaseController.LogTrace = false;	

var TabController = BaseController.create({
	active: function() {
		this.el.parent().children('div').hide();
		this.el.show();
		this.trace("Tab Active");
	},
});