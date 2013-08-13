var ApplicationController = TabController.create({
	logPrefix: 'Application',

	elements: {
		'#toteboard-data'	: 'toteboardForm',
		'#toteboard-dates'	: 'toteboardDates',
		'#date-races'		: 'dateRaces'
	},

	init: function() {
		this.toteboardController = new ToteboardController({ el: this.toteboardForm });
		this.datesController = new DatesController({ el: this.toteboardDates });
		this.dateRacesController = new DateRacesController({ el: this.dateRaces });
	}
});

var ToteboardController = BaseController.create({
	logPrefix: 'Toteboard',

	elements : {
		'input[name=data-url]'	: 'urlEl',
		'button[type=button]'	: 'submitEl',
		'.control-group'		: 'containerEl'
	},

	events: { 
		'click button[type=button]'	: 'submit'
	},

	init: function() {
		URLModel.bind('refresh', this.proxy(this.dataUpdated));
	},

	dataUpdated: function() {
		if (URLModel.all().length === 0) {
			var url = URLModel.create({ value: 'http://www.churchilldowns.com/racing-wagering' });
			this.log("Url updated to default");
		}
		this.urlEl.val(URLModel.first().value);
		this.log("Url updated to " + URLModel.first().value);
	},

	submit: function(evt) {
		if (evt)
			evt.preventDefault();
		var url = URLModel.first();
		url.value = this.urlEl.val();
		url.save();
		this.sendRequest(url.value);
	},

	sendRequest: function(url) {
		$.ajax({
		    url: url,
		    path: '.day-nav li span a',
		    type: 'GET',
		    beforeSend: this.proxy(this.urlBeforeSend),
		    success: this.proxy(this.urlLoaded),
		    error: this.proxy(this.urlError),
		    complete: this.proxy(this.urlComplete)
		});
	},

	urlBeforeSend: function() {
		this.submitEl.prop('disabled', true).addClass('btn-warning').data('text', this.submitEl.text()).text('Refreshing');
		this.log("Sending request to get dates");
	},

	urlError: function(xhr, textStatus, errorThrown) {
		this.showAlert(this.containerEl, 'error', 'Unknown error occurred. Message: ' + textStatus);
		this.log("Failed to retrieve dates. Error: " + errorThrown);
	},

	urlLoaded: function(data) {
		this.showAlert(this.containerEl, 'success', 'Data successfully retrieved');
		var url = ((URLModel.first().value||'')+'').match(/^http:\/\/[^/]+/)[0];

		var dateRecords = [];
		$.each(data.results, function(index, value) {
			var el = $(value);
			dateRecords.push({ url: url + el.attr('href'), date: el.html() });
		});
		DateModel.refresh(dateRecords, { clear: true });
		this.log("Successfully retrieved " + dateRecords.length + " dates");
	},

	urlComplete: function() {
		this.submitEl.prop('disabled', false).removeClass('btn-warning').text(this.submitEl.data('text'));
	}
});

var DatesController = BaseController.create({
	logPrefix: 'Dates',
	elements : {
		'select[name=race-dates]'	: 'datesEl',
		'.control-group'			: 'containerEl',
		'button[type=button]'		: 'buttonEl'
	},

	events: { 
		'click button[type=button]'	: 'save'
	},

	init: function() {
		DateModel.bind('refresh', this.proxy(this.dataUpdated));
	},

	dataUpdated: function() {
		var select = this.datesEl;
		select.find('option').remove();

		if (DateModel.all().length === 0) {
			var option = $('<option></option>');
			option.text('No Dates');
			select.append(option);
			this.buttonEl.prop('disabled', true);
			this.log("Date Model doesn't have any dates");
			return;
		} 

		if (this.containerEl.is(':visible')) {
			this.showAlert(this.containerEl, 'info', 'Race dates refreshed');
		}
		this.buttonEl.prop('disabled', false);
		if (DateModel.findByAttribute('selected', true) == null) {
			this.showAlert(this.containerEl, 'info', 'No current race date selected, please select a date and click set as current.', { permanent: true, tag: 'no-date-selected' });
		}

		$.each(DateModel.all(), function (index, value) {
			var option = $('<option></option>');
			option.text(value.date);
			option.val(value.url);
			if (value.selected) {
				option.prop('selected', true);
			}
			select.append(option);
		});
		this.log("Successfully added " + DateModel.all().length + " dates");
	},

	save: function(evt) {	
		this.removeAlert('no-date-selected');
		evt.preventDefault();
		var date = DateModel.findByAttribute('url', this.datesEl.find(':selected').val());
		if (date != null) {
			this.setAsCurrent(date);
		} else {
			this.showAlert(this.containerEl, 'error', 'Error, couldn\'t find date to save');
			this.log("Error, couldn't find date to save");
		}
	},

	setAsCurrent: function(date) {
		var selectedDate = DateModel.findByAttribute('selected', true);
		if (selectedDate != null && !selectedDate.eql(date)) {
			selectedDate.selected = false;
			selectedDate.save();
		}
		date.selected = true;
		date.save();
		this.showAlert(this.containerEl, 'success', 'Current race date saved');
		this.log("Successfully saved date to " + date.date);
	}
});

var DateRacesController = BaseController.create({
	logPrefix: 'DateRaces',
	elements: {
		'select[name=races]'	: 'racesEl',
		'button[type=button]'	: 'buttonEl',
		'.control-group'		: 'containerEl'
	},

	events: { 
		'click button[type=button]'	: 'refreshDates'
	},

	init: function() {
		DateModel.bind('refresh change', this.proxy(this.dataUpdated));
		RaceModel.bind('refresh', this.proxy(this.dataUpdated));
	},

	dataUpdated: function() {
		var select = this.racesEl;
		select.find('option').remove();

		var selectedDate = DateModel.findByAttribute('selected', true);

		if (selectedDate == null) {
			this.log("Unable to update race dates, no Date selected");
			return;
		}

		var races = selectedDate.races().all();
		if (races.length == 0) {
			var option = $('<option></option>');
			option.text('No Dates');
			select.append(option);
			this.log("Selected date does not contain any races. Need to refresh");
			return;
		}

		$.each(races, function (index, value) {
			var option = $('<option></option>');
			option.text(value.name);
			option.val(value.url);
			if (value.selected === true) {
				option.prop('selected', true);
			}
			select.append(option);
		});
		this.log("Added " + races.length + " races from selected date");
	},

	refreshDates: function(evt) {
		if (evt) {
			evt.preventDefault();
		}

		var selected = DateModel.findByAttribute('selected', true);
		if (selected == null) {
			return;			
		}

		$.ajax({
		    url: selected.url,
		    path: '.race-nav li a',
		    type: 'GET',
		    beforeSend: this.proxy(this.racesBeforeSend),
		    success: this.proxy(this.racesLoaded),
		    error: this.proxy(this.racesError),
		    complete: this.proxy(this.racesComplete)
		});
	},

	racesBeforeSend: function() {
		this.buttonEl.prop('disabled', true).addClass('btn-warning').data('text', this.buttonEl.text()).text('Refreshing');
		this.log("Sending request to get races");
	},

	racesError: function(xhr, textStatus, errorThrown) {
		this.showAlert(this.containerEl, 'error', 'Unknown error occurred. Message: ' + textStatus);
		this.log("Failed to retrieve dates. Error: " + errorThrown);
	},

	racesLoaded: function(data) {
		this.showAlert(this.containerEl, 'success', 'Races successfully retrieved');
		var url = ((URLModel.first().value||'')+'').match(/^http:\/\/[^/]+/)[0];
		var selectedDate = DateModel.findByAttribute('selected', true);

		$.each(selectedDate.races().all(), function(index, value) {
			value.destroy();
		});
		$.each(data.results, function(index, value) {
			var el = $(value);
			selectedDate.races().create({ url: url + el.attr('href'), name: el.html(), expired: false, calculated: false, selected: false });
		});
		this.log("Successfully retrieved " + data.results.length + " dates");
		RaceModel.trigger('refresh');
	},

	racesComplete: function() {
		this.buttonEl.prop('disabled', false).removeClass('btn-warning').text(this.buttonEl.data('text'));
	}
});