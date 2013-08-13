var HomeController = TabController.create({
	logPrefix: 'Home',
	baseActive: null,
	playersController: null,
	horsesController: null,
	historyController: null,
	configController: null,

	elements: {
		'span[data-type=header-date]'	: 'headerEl',
		'span[data-type=race-number]'	: 'raceEl',
		'div[data-type=notification]'	: 'notificationEl',
		'li a[href=#select-player]'		: 'playerTab',
		'li a[href=#place-bet]'			: 'betTab',
		'li a[href=#bet-history]'		: 'historyTab',
		'li a[href=#race-config]'		: 'configTab'
	},

	init: function() {
		this.baseActive = this.active;
		this.active = this.activeWrapper;
		this.playersController = new PlayersController({ el: '#select-player', container: this.playerTab, containerNext: this.betTab, notificationEl: this.notificationEl });
		this.horsesController = new HorsesController({ el: '#place-bet', container: this.betTab, containerNext: this.historyTab, notificationEl: this.notificationEl });
		this.historyController = new HistoryController({ el: '#bet-history', container: this.historyTab, notificationEl: this.notificationEl });
		this.configController = new ConfigController({ el: '#race-config', container: this.configTab, notificationEl: this.notificationEl });

		DateModel.bind('refresh change', this.proxy(this.updateDate));
		RaceModel.bind('refresh change', this.proxy(this.updateRace));
	},

	activeWrapper: function() {
		this.removeAlert('no-dates');
		this.removeAlert('no-date-selected');
		this.removeAlert('no-players');
		if (DateModel.all().length == 0) {
			this.showAlert(this.notificationEl, 'info', 'No race dates found, click <a href="javascript:" onclick="tabs.trigger(\'change\', \'application-setup\');">Application Setup</a> to setup the dates, and then select a date.', { permanent: true, tag: 'no-dates' });
		} else if (DateModel.findByAttribute('selected', true) == null) {
			this.showAlert(this.notificationEl, 'info', 'No current race date selected, click <a href="javascript:" onclick="tabs.trigger(\'change\', \'application-setup\');">Application Setup</a> to select the dates.', { permanent: true, tag: 'no-date-selected' });
		}

		if (PlayerModel.all().length == 0) {
			this.showAlert(this.notificationEl, 'info', 'No players found, click <a href="javascript:" onclick="tabs.trigger(\'change\', \'player-setup\');">Player Setup</a> to setup the players.', { permanent: true, tag: 'no-players' });
		}

		var selectedPlayer = PlayerModel.findByAttribute('selected', true);
		if (selectedPlayer != null) {
			selectedPlayer.selected = false;
			selectedPlayer.save();
		}
		this.playerTab.tab('show');

		this.baseActive();
	},

	updateDate: function() {
		var selected = DateModel.findByAttribute('selected', true);
		if (selected == null) {
			this.headerEl.text('No Date Selected');
		} else {
			this.headerEl.text(selected.date);
		}
	},

	updateRace: function() {
		var selectedDate = DateModel.findByAttribute("selected", true);
		if (selectedDate == null)
		{
			this.raceEl.text('No Race Selected');
			return;
		}
		var selected = selectedDate.races().findByAttribute('selected', true);
		if (selected == null) {
			this.raceEl.text('No Race Selected');
		} else {
			this.raceEl.text(selected.name + " (Post: " + FormatTime(selected.postTime) + ")");
		}
	}
});

var PlayersController = BaseController.create({
	logPrefix: 'Players',
	elements: {
		'table tbody'	: 'bodyEl'
	},

	init: function() {
		PlayerModel.bind('refresh', this.proxy(this.playersUpdated));
		PlayerModel.bind('create', this.proxy(this.playerAdded));
		this.container.bind('click', this.proxy(this.show));
		this.show();
	},

	show: function() {
		var selectedPlayer = PlayerModel.findByAttribute('selected', true);
		if (selectedPlayer != null) {
			selectedPlayer.selected = false;
			selectedPlayer.save();
		}
		this.container.tab('show');
	},

	playersUpdated: function() {
		var me = this;
		$.each(PlayerModel.all(), function (index, value) {
			var row = new PlayersRowController({ item: value, containerNext: me.containerNext });
			me.bodyEl.append(row.el);
			row.render();
		});
	},

	playerAdded: function(item) {
		var row = new PlayersRowController({ item: item, containerNext: this.containerNext });
		this.bodyEl.append(row.el);
		row.render();
	}
});

var PlayersRowController = BaseController.create({
	logPrefix: 'PlayersRow',
	tag: 'tr',
	playerTemplate: null,

	events: {
		'click button[data-action=select]' : 'selectPlayer'
	},

	init: function() {
		this.playerTemplate = $('#player-template');
		this.item.bind('change', this.proxy(this.render));
		this.item.bind('destroy', this.proxy(this.removePlayer));
	},

	render: function() { 
		var	template = this.playerTemplate.tmpl({ name: this.item.name, 
			funds: this.item.totalFunds(), 
			lastBetWinnings: this.item.lastBetWinnings || 0, 
			totalBet: this.item.totalBet(), 
			totalWon: this.item.totalWon(), 
			roi: this.item.roi()
		});
		this.html(template);
	},

	selectPlayer: function() {
		this.item.selected = true;
		this.item.save();
		this.containerNext.tab('show');
	},

	removePlayer: function() {
		this.release();
	}
});

var HorsesController = BaseController.create({
	logPrefix: 'Horses',
	currentRaceId: null,
	selectedPlayerId: null,
	rows: [],

	elements: { 
		'table.horses tbody'				: 'bodyEl',
		'div.winners'						: 'winnersEl',
		'span[data-type=selected-player]'	: 'playerEl',
		'span[data-type=fund-total]'		: 'fundsEl',
		'button[data-action=place-bet]'		: 'buttonEl',
		'div[data-type=bet-notification]'	: 'betNotificationEl',
		'#bet-modal'						: 'modalEl'
	},

	events: { 
		'click button[data-action=place-bet]'	: 'placeBet'
	},

	init: function() {
		this.winTemplateEl = $("#win-template");
		this.container.bind('click', this.proxy(this.show));
		this.container.on('shown', this.proxy(this.updateTab));
		RaceModel.bind('refresh', this.proxy(this.refreshRace));
	},

	show: function() {
		var selectedPlayer = PlayerModel.findByAttribute('selected', true);
		if (selectedPlayer != null) {
			this.container.tab('show');
		} else {
			this.showAlert(this.notificationEl, 'error', 'You must select a player first');
		}
	},

	placeBet: function() {
		var selectedPlayer = PlayerModel.findByAttribute('selected', true);
		var selectedDate = DateModel.findByAttribute("selected", true);
		if (selectedDate == null) {
			this.showAlert(this.notificationEl, 'error', 'No date selected');
			return
		}

		var selectedRace = selectedDate.races().findByAttribute('selected', true);
		if (selectedRace == null) {
			this.showAlert(this.notificationEl, 'error', 'No race selected');
			return	
		}
		var totalFunds = selectedPlayer.totalFunds();

		var inputs = this.bodyEl.find('td.bet input');
		var betTotal = 0;
		$.each(inputs, function(index, value){
			value = $(value);
			var bet = parseFloat(value.val());
			if (isNaN(bet)) {
				return;
			}
			betTotal += FormatNumber(bet);
		});

		// Validate Bets
		if (betTotal <= 0) {
			this.showAlert(this.betNotificationEl, 'error', 'No bets placed');
			return;
		}

		if (betTotal > totalFunds) {
			this.showAlert(this.betNotificationEl, 'error', 'You are betting more than you have funds for. Total bet: ' + betTotal + ', Total funds: ' + totalFunds);
			return;
		}

		// Process bets
		var rows = this.bodyEl.find('tr');
		var bets = [];
		$.each(rows, function(index, value){
			value = $(value);
			var bet = {
				horseId: value.find('input[name=horse_id]').val(),
				win: GetNumber(value.find('input[name=to-win]').val()),
				place: GetNumber(value.find('input[name=to-place]').val()),
				show: GetNumber(value.find('input[name=to-show]').val())
			};

			if (bet.win || bet.place || bet.show) {
				bets.push(bet);
			}
		});

		// Add bets to player 
		$.each(bets, function(index, bet) {
			var horse = selectedRace.horses().find(bet.horseId);
			selectedPlayer.bets().create({ race: selectedRace, horse: horse, win: bet.win, place: bet.place, show: bet.show });
			var message = 'Bet placed on race: ' + selectedRace.name + ', horse: (' + horse.number + ') ' + horse.name + ', ';
			if (bet.win) {
				message += 'To Win: $' + bet.win + ', ';
			}
			if (bet.place) {
				message += 'To Place: $' + bet.place + ', ';
			}
			if (bet.show) {
				message += 'To Show: $' + bet.show + ', ';
			}
			message = message.substring(0, message.length - 2);
			selectedPlayer.funds().create({ date: new Date(), amount: -(bet.win + bet.place + bet.show), action: message, type: 'Bet' });
		});

		this.bodyEl.find('tr td input[name^=to-]').val('');
		// Show Confirmation
		var me = this;
		this.modalEl.find('.modal-body p').text('Bet has been placed. Please pay: $' + betTotal);
		this.modalEl.modal();
		this.modalEl.on('hidden', function() {
			me.containerNext.tab('show');
		});
	},

	updateTab: function() {
		var selectedPlayer = PlayerModel.findByAttribute('selected', true);
		if (selectedPlayer != null) {
			this.playerEl.text(selectedPlayer.name);
			this.fundsEl.text(selectedPlayer.totalFunds());
			if (this.selectedPlayerId !== selectedPlayer.id) {
				this.bodyEl.find('tr td input[name^=to-]').val('').trigger("keyup");
				this.selectedPlayerId = selectedPlayer.id;
			}
		} else {
			this.playerEl.text('');
			this.fundsEl.text('0');
		}
	},

	refreshRace: function() {
		var selectedDate = DateModel.findByAttribute("selected", true);
		if (selectedDate == null) {
			this.showAlert(this.notificationEl, 'error', 'No date selected');
			return
		}

		var selectedRace = selectedDate.races().findByAttribute('selected', true);
		if (selectedRace == null) {
			this.showAlert(this.notificationEl, 'error', 'No race selected');
			return	
		}
		if (selectedRace != this.currentRaceId) {
			$.each(this.rows, function(index, value) {
				value.release();
			});
			this.bodyEl.html('');
			this.currentRaceId = selectedRace.id;

			var me = this;
			$.each(selectedRace.horses().all(), function(index, value) {
				var row = new HorseRowController({ item: value, race: selectedRace });
				row.render();
				me.bodyEl.append(row.el);
				me.rows.push(row);
			});
			if (selectedRace.finished) {
				this.winnersEl.show();
				this.winnersEl.find('table tbody').html('');
				var win = this.winTemplateEl.tmpl(selectedRace.win);
				var place = this.winTemplateEl.tmpl(selectedRace.place);
				var show = this.winTemplateEl.tmpl(selectedRace.show);
				this.winnersEl.find('table tbody').append(win);
				this.winnersEl.find('table tbody').append(place);
				this.winnersEl.find('table tbody').append(show);
			} else {
				this.winnersEl.hide();
			}
		}
		if (selectedRace.finished) {
			this.buttonEl.hide();
		} else {
			this.buttonEl.show();
		}
	}
});

var HorseRowController = BaseController.create({
	logPrefix: 'HorseRow',
	tag: 'tr',
	horseTemplate: null,

	elements: { 
		'td.name'	: 'nameEl',
		'td.odds'	: 'oddsEl',
		'td.bet'	: 'betEl',
		'span[data-type=estimated-winning]'	: 'winningsEl',
		'span[data-type=bet-cost]'	: 'costEl',
		'input[name=to-win]'	: 'winEl',
		'input[name=to-place]'	: 'placeEl',
		'input[name=to-show]'	: 'showEl'
	},

	events: { 
		'keyup td.bet input'	: 'parseOdds'
	},

	init: function() {
		this.el.addClass('entry');
		this.horseTemplate = $('#horse-template');
		this.item.bind('update', this.proxy(this.updateData));
	},

	render: function() {
		this.item.finished = this.race.finished;
		var	template = this.horseTemplate.tmpl(this.item);
		this.html(template);
		if (this.item.scratched === true) {
			this.el.addClass('scratched');
		}
		this.betEl.find('input').numeric({ negative: false, decimal: false });
	},

	updateData: function() {
		if (this.item.scratched === true && this.el.hasClass('scratched') === false) {
			this.el.addClass('scratched');
			this.betEl.html('').effect("highlight", 4000);
			this.betEl.filter(':first').html('Out of Race');
			this.winningsEl.text(0);
			this.costEl.text(0);
		}
		this.highlightIfDifferent(this.nameEl, this.item.name);
		this.highlightIfDifferent(this.oddsEl, this.item.currentOdds, true);
	},

	highlightIfDifferent: function(el, text, parse) {
		var current = el.text();
		if (current != text) {
			el.text(text).effect("highlight", 4000);
			if (parse) {
				this.parseOdds();
			}
		}
	},

	parseOdds: function() {
		// Validate input
		// Get odds
		var numberOdds = getOdds(this.item.currentOdds, this.item.morningOdds);
		var cost = 0;
		var total = 0;

		var win = parseFloat(this.winEl.val());
		if (!isNaN(win)) {
			var toWin = calculateToWin(numberOdds, win);
			cost += win;
			total += toWin;
		}
		var place = parseFloat(this.placeEl.val());
		if (!isNaN(place)) {
			var toPlace = calculateToPlace(numberOdds, place);
			cost += place;
			total += toPlace;
		}
		var show = parseFloat(this.showEl.val());
		if (!isNaN(show)) {
			var toShow = calculateToShow(numberOdds, show);
			cost += show;
			total += toShow;
		}
		this.winningsEl.text(FormatNumber(total));
		this.costEl.text(cost);
	}
});

var HistoryController = BaseController.create({
	logPrefix: 'History',
	fundTemplate: null, 

	elements: { 
		'span[data-type=selected-player]'	: 'playerEl',
		'span[data-type=fund-total]'		: 'fundsEl',
		'table tbody'						: 'bodyEl'
	},

	init: function() {
		this.fundTemplate = $('#fund-template');
		this.container.bind('click', this.proxy(this.show));
		this.container.on('shown', this.proxy(this.updateTab));
	},

	show: function() {
		var selectedPlayer = PlayerModel.findByAttribute('selected', true);
		if (selectedPlayer != null) {
			this.container.tab('show');
		} else {
			this.showAlert(this.notificationEl, 'error', 'You must select a player first');
		}
	},

	render: function() {
		var selectedPlayer = PlayerModel.findByAttribute('selected', true);
		var funds = selectedPlayer.funds().all();
		var templates = [];
		var me = this;
		var balance = 0;
		$.each(funds, function(index, value){
			balance += value.amount;
			value.balance = balance;
			var template = me.fundTemplate.tmpl(value);
			templates.push(template[0]);
		});
		this.bodyEl.html(templates);
	},
	
	updateTab: function() {
		var selectedPlayer = PlayerModel.findByAttribute('selected', true);
		if (selectedPlayer != null) {
			this.playerEl.text(selectedPlayer.name);
			this.fundsEl.text(selectedPlayer.totalFunds());
		} else {
			this.playerEl.text('');
			this.fundsEl.text('0');
		}
		this.render();
	}
});

var ConfigController = BaseController.create({
	logPrefix: 'Config',
	raceRefreshController: null,
	calculateWinningsController: null,

	init: function() {
		this.raceRefreshController = new RaceRefreshController({ el: '#set-race', notificationEl: this.notificationEl });
		this.calculateWinningsController = new CalculateWinningsController({ el: '#calculate-winnings', notificationEl: this.notificationEl });
		this.container.bind('click', this.proxy(this.show));
	},

	show: function() {
		this.container.tab('show');
	}
});

var RaceRefreshController = BaseController.create({
	logPrefix: 'RaceRefresh',
	autoRefreshing: false,

	elements: {
		'select[name=races]'	: 'racesEl',
		'button[name=refresh]'	: 'buttonEl',
		'button[name=auto]'		: 'autoEl'
	},

	events: {
		'click button[name=refresh]'	: 'updateHorses',
		'change select[name=races]'		: 'updateHorses',
		'click button[name=auto]'		: 'autoRefresh'
	},

	init: function() {
		DateModel.bind('refresh change', this.proxy(this.dataUpdated));
		RaceModel.bind('refresh', this.proxy(this.dataUpdated));
	},

	dataUpdated: function() {
		var select = this.racesEl;
		select.find('option').remove();
		this.buttonEl.prop('disabled', true);

		var selectedDate = DateModel.findByAttribute('selected', true);
		if (selectedDate == null) {
			var option = $('<option>No Races Exist</option>');
			select.append(option);
			this.autoEl.hide();
			return;
		}

		if (selectedDate.races().all() == 0) {
			this.autoEl.hide();
			return;
		}

		var selected = false;
		$.each(selectedDate.races().all(), function (index, value) {
			var option = $('<option></option>');
			option.text(value.name);
			option.val(value.url);
			if (selected === false && value.selected === true) {
				option.prop('selected', true);
				selected = true;
			}
			select.append(option);
		});
		this.buttonEl.prop('disabled', false);
		this.autoEl.show();
		this.autoRefresh({ stop: true });
	},

	updateHorses: function(evt) {
		if (evt !== undefined) {
			evt.preventDefault();
		}

		var selectedDate = DateModel.findByAttribute('selected', true);
		if (selectedDate == null || selectedDate.races().all().length === 0) {
			return;			
		}

		var selected = this.racesEl.find(':selected');
		var race;
		if (selected.length > 0) {
			race = selectedDate.races().findByAttribute('url', selected.val());
			if (race == null) {
				this.showAlert(this.notificationEl, 'error', 'Unable to find race for url ' + selected.val());
				return; // didn't find a race in the list
			}
			var current = selectedDate.races().findByAttribute('selected', true);
			if (current != null && !current.eql(race)) {
				current.selected = false;
				current.save();
			}
			race.selected = true;
			race.save();
		}

		this.send(race, this.horsesLoaded);
	},

	send: function(race, success) {
		$.ajax({
		    url: race.url,
		    path: '.entry, .mtp, table.result-data:first tbody tr',
		    type: 'GET',
		    beforeSend: this.proxy(this.horsesBeforeSend),
		    success: this.proxy(success),
		    error: this.proxy(this.horsesError),
		    complete: this.proxy(this.horsesComplete)
		});
	},

	horsesBeforeSend: function() {
		this.buttonEl.prop('disabled', true).addClass('btn-warning').data('text', this.buttonEl.text()).text('Refreshing');
	},

	horsesError: function(xhr, textStatus, errorThrown) {
		this.showAlert(this.notificationEl, 'error', 'Unknown error occurred. Message: ' + textStatus);
	},

	horsesLoaded: function(data) {
		this.showAlert(this.notificationEl, 'success', 'Horses successfully updated');
		var selectedDate = DateModel.findByAttribute('selected', true);
		if (selectedDate == null) {
			return;
		}
		var selectedRace = selectedDate.races().findByAttribute('selected', true);
		if (selectedRace == null) {
			return;
		}

		this.reloadData(selectedDate, selectedRace, data);
		
		RaceModel.trigger('refresh');
	},

	horsesComplete: function() {
		this.buttonEl.prop('disabled', false).removeClass('btn-warning').text(this.buttonEl.data('text'));
	},

	reloadData: function(selectedDate, selectedRace, data) {
		var me = this;
		$.each(data.results, function(index, value) {
			value = $(value);

			// getting multiple types of return data. This is looking for post times.
			// Everything else should be a horse
			if (value.hasClass('mtp')) {
				//if (!selectedRace.postTime) {
					var year = $.format.date(new Date(), 'yyyy');
					var time = value.find('span').text().replace('Est. Post Time: ', '');
					var date = new Date(selectedDate.date + ' ' + year + ' ' + time);
					if (!isNaN(date.getTime())) {
						date.setHours(date.getHours() - 2); // change from est time
						selectedRace.postTime = date;
						selectedRace.save();
					}
				//}
				return;
			}

			// Do we have horse race result
			if (value.find('td.horse-name').length > 0) {
				if (!selectedRace.finished) {
					var numbers = value.find('td p:contains($)');
					var dyn = 3 - numbers.length;
					var finish = {
						number: $.trim(value.find('td span').text()),
						name: $.trim(value.find("td.horse-name p").text()),
						style: /saddle\-\d+a?/i.exec(value.find("td span").attr('class'))[0] || '',
						winAmount: (numbers.length == 3 ? GetNumber($(numbers[0 - dyn]).text()) : 0),
						placeAmount: (numbers.length >= 2 ? GetNumber($(numbers[1 - dyn]).text()) : 0),
						showAmount: (numbers.length >= 1 ? GetNumber($(numbers[2 - dyn]).text()) : 0),
					}; 

					if (numbers.length === 3) {
						selectedRace.win = finish;
					} else if (numbers.length === 2) {
						selectedRace.place = finish;
					} else if (numbers.length === 1) {
						selectedRace.show = finish;
					}
				}

				if (selectedRace.win && selectedRace.place && selectedRace.show) {
					selectedRace.finished = true;
					selectedRace.save();
				}
				return;
			}

			if (!value.attr('class').match(/saddle\-\d+a?/i)) {
				return; // garbage data from race results
			}

			result = {
				number: $.trim(value.find('h3').text()),
				name: $.trim(value.find('h4').text()),
				morningOdds: $.trim(value.find('div.odds span.ml').text().replace('ML:', '')),
				currentOdds: $.trim(value.find('div.odds span.current').text().replace('Current:', '')),
				jockey: $.trim(value.find('div.jockey').text()),
				jockeyWeight: $.trim(value.find('div.jockey span.weight').text()),
				trainer: $.trim(value.find('div.trainer').text()),
				scratched: value.hasClass('scratched'),
				style: /saddle\-\d+a?/i.exec(value.attr('class'))[0] || ''
			};

			var horse = selectedRace.horses().findByAttribute('number', result.number);
			if (horse == null) {
				var horse = selectedRace.horses().create(result);
			} else {
				for (key in result) {
				  value = result[key];
				  if (!(value + "").length) {
				  	delete result[key];
				  }
				}

				horse.updateAttributes(result);
			}			
		});
		return selectedRace.finished;
	},

	autoRefresh: function(options) {
		options = options || {};
		if (options.stop || this.autoRefreshing) {
			this.autoRefreshing = false;
			this.autoEl.html("Start Auto Refresh").addClass("btn-success").removeClass("btn-warning");
			this.racesEl.show();
			this.buttonEl.show();
			return;
		}

		var selectedDate = DateModel.findByAttribute('selected', true);
		if (selectedDate == null) {
			return;
		}
		var selectedRace = selectedDate.races().findByAttribute('selected', true);
		if (selectedRace == null) {
			return;
		}
		this.autoRefreshing = true;
		this.racesEl.hide();
		this.buttonEl.hide();
		this.autoEl.html("Stop Auto Refresh " + selectedRace.name).addClass("btn-warning").removeClass("btn-success");
		var me = this;
		window.setTimeout(function() { me.proxy(me.loop(selectedDate, selectedRace)) }, 40000); // 40 seconds between refreshing
	},

	loop: function(selectedDate, selectedRace) {
		if (!this.autoRefreshing)
			return; // refreshing stopped

		this.send(selectedRace, function(data) {
			var finished = this.reloadData(selectedDate, selectedRace, data);
			if (finished) {
				this.showAlert(this.notificationEl, 'info', "Auto Refresh Stopped. Current Race Finished", { permanent: true });
				this.autoRefresh({ stop: true });
				RaceModel.trigger('refresh');
			} else {
				this.showAlert(this.notificationEl, 'success', "Racing stats updated");
				var me = this;
				window.setTimeout(function() { me.proxy(me.loop(selectedDate, selectedRace)) }, 40000);
			}
		});
	}
});

var CalculateWinningsController = BaseController.create({
	logPrefix: 'RaceRefresh',
	template: null,

	elements: {
		"tbody"	: "bodyEl"
	},

	events: {
		"click button"	: "calculate" 
	},

	init: function() {
		this.template = $("#calculate-template");
		DateModel.bind('refresh change', this.proxy(this.render));
		RaceModel.bind('refresh change', this.proxy(this.render));
	},

	render: function() {
		this.bodyEl.empty();
		var selectedDate = DateModel.findByAttribute('selected', true);
		if (selectedDate == null) {
			return;
		}
		var me = this;
		$.each(selectedDate.races().all(), function(index, race) {
			var	template = me.template.tmpl(race);
			me.bodyEl.append(template);
		});
	},

	calculate: function(evt) {
		var target = $(evt.currentTarget);

		var race = RaceModel.exists(target.data("id"));
		if (!race) {
			this.showAlert(this.notificationEl, 'error', "Race can not be found to process");
			return;
		}

		var bets = this.getBets(race);

		if (bets.length === 0) {
			this.showAlert(this.notificationEl, 'info', "Race has no bets to process");
			race.updateAttribute("calculated", true);
			return;
		}

		$.each(PlayerModel.all(), function(index, player) {
			player.updateAttribute("lastBetWinnings", 0);
		});
		this.calculateWinnings(race, bets);
		race.updateAttribute("calculated", true);
	},

	getBets: function(selectedRace) {
		var bets = [];
		$.each(BetModel.all(), function(index, bet){
			if (bet.race.id === selectedRace.id) {
				bets.push(bet);
			}
		});
		return bets;
	},

	calculateWinnings: function(selectedRace, bets) {
		$.each(bets, function(index, bet){
			var horse = HorseModel.find(bet.horse.id);
			var player = bet.player();
			var funds = player.funds();

			// Payout amounts are based on 2 dollars, subtract original bet, divide by 2, then multiply by bet amount
			var calculateNumber = function(winningAmount, bet) {
				if (!winningAmount || !bet) {
					throw "Something isn't right, should have numbers in calculation";
					return 
				}

				var base = (winningAmount - 2) / 2;
				return FormatNumber((base * bet) + bet);
			}

			// Reverse bet if it was a scratch
			if (horse.scratched && 
				(bet.win || bet.place || bet.show)) {
				funds.create({ date: new Date(), action: 'Bet Refund for horse scratch. Race: ' + selectedRace.name + ', Horse: (' + bet.horse.number + ') ' + bet.horse.name + '.', amount: (bet.win + bet.place + bet.show), type: 'Bet' });
				bet.destroy();
				player.trigger("change");
				return;
			}

			if (bet.horse.number == selectedRace.win.number ||
				bet.horse.number == selectedRace.place.number ||
				bet.horse.number == selectedRace.show.number) {
				// winner
				
				var calc = 0;
				if (bet.win && 
					bet.horse.number == selectedRace.win.number) {
					calc = selectedRace.win.winAmount;

					var amount = calculateNumber(calc, bet.win)

					player.lastBetWinnings += amount;

					funds.create({ date: new Date(), action: 'Paid bet. Race: ' + selectedRace.name + ', Horse: (' + bet.horse.number + ') ' + bet.horse.name + '. To win', amount: amount, type: 'Payout' });
				}
				if (bet.place && 
					(bet.horse.number == selectedRace.win.number ||
					 bet.horse.number == selectedRace.place.number)) {

					if (bet.horse.number == selectedRace.win.number)
						calc = selectedRace.win.placeAmount;
					else 
						calc = selectedRace.place.placeAmount;

					var amount = calculateNumber(calc, bet.place)

					player.lastBetWinnings += amount;

					funds.create({ date: new Date(), action: 'Paid bet. Race: ' + selectedRace.name + ', Horse: (' + bet.horse.number + ') ' + bet.horse.name + '. To place', amount: amount, type: 'Payout'  });
				}
				if (bet.show &&
					(bet.horse.number == selectedRace.win.number ||
					 bet.horse.number == selectedRace.place.number ||
					 bet.horse.number == selectedRace.show.number)) {

					if (bet.horse.number == selectedRace.win.number)
						calc = selectedRace.win.showAmount;
					else if (bet.horse.number == selectedRace.place.number)
						calc = selectedRace.place.showAmount;
					else 
						calc = selectedRace.show.showAmount;

					var amount = calculateNumber(calc, bet.show)

					player.lastBetWinnings += amount;

					funds.create({ date: new Date(), action: 'Paid bet. Race: ' + selectedRace.name + ', Horse: (' + bet.horse.number + ') ' + bet.horse.name + '. To show', amount: amount, type: 'Payout'  });
				}
				player.save();
			}
			bet.destroy();
		});
	}
});
