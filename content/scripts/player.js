var PlayerController = TabController.create({
	logPrefix: 'Player',
	elements: { 
		'table tbody'	: 'bodyEl'
	},

	events: { 
		'click button[data-action=new]'	: 'addPlayer'
	},

	init: function () {
		PlayerModel.bind('refresh', this.proxy(this.dataUpdated));
	},

	addPlayer: function() {
		var value = PlayerModel.create({ name: '', selected: false });
		var row = new PlayerRowController({ item: value, new: true });
		this.bodyEl.append(row.el);
		row.render();
	},

	dataUpdated: function() {
		var me = this;
		$.each(PlayerModel.all(), function (index, value) {
			var row = new PlayerRowController({ item: value });
			me.bodyEl.append(row.el);
			row.render();
		});
	}
});

var PlayerRowController = BaseController.create({
	logPrefix: 'PlayerRow',
	tag: 'tr',
	item: null,
	new: false,
	editing: false,
	addTemplate: null,
	viewTemplate: null,
	deleteModal: null,

	elements: {
		'input[data-type=name]'		: 'inputNameEl',
		'span[data-type=name]'		: 'spanNameEl',
		'input[data-type=funds]'	: 'inputFundsEl',
		'span[data-type=funds]'		: 'spanFundsEl',
	},

	events: { 
		'click button[data-action=edit]'	: 'edit',
		'click button[data-action=delete]'	: 'delete',
		'click button[data-action=save]'	: 'save',
		'click button[data-action=cancel]'	: 'cancel',
	},

	init: function() {
		this.addTemplate = $('#add-template');
		this.viewTemplate = $('#view-template');
		this.deleteModal = $('#delete-modal');
	},

	render: function() { 
		var template; 
		if (this.new || this.editing) {
			template = this.addTemplate.tmpl({ name: this.item.name, funds: this.item.totalFunds() });
		} else {
			template = this.viewTemplate.tmpl({ name: this.item.name, funds: this.item.totalFunds() });
		}
		this.html(template);
	},

	edit: function() {
		this.editing = true;
		this.render();
	},

	delete: function() {
		var del = this.deleteModal.find('a[data-action=delete]');
		var can = this.deleteModal.find('a[data-action=cancel]');

		del.bind('click', this.proxy(function() {
			this.item.destroy();
			this.release();
			this.deleteModal.modal('hide');
		}));
		can.bind('click', this.proxy(function() {
			this.deleteModal.modal('hide');
		}));
		this.deleteModal.modal();
		this.deleteModal.on('hidden', function() {
			del.unbind('click');
			can.unbind('click');
		});
	},

	save: function() {
		if (!this.validate()) return;
		// save player
		this.item.name = $.trim(this.inputNameEl.val());
		// save funds
		var newTotal = FormatNumber(this.inputFundsEl.val());
		var currentTotal = this.item.totalFunds();
		if (currentTotal !== newTotal) {
			var fund = this.item.funds().create({
				date: new Date(),
				type: (this.new ? 'Deposit' : 'Adjustment'),
				action: 'Adjusting funds to new total',
				amount: (newTotal - currentTotal)
			});
		}
		this.item.save();
		this.editing = false;
		this.new = false;
		
		this.render();
	},

	cancel: function() {
		if (this.new) {
			this.item.destroy();
			this.release();
		} else {
			this.editing = false;
			this.render();
		}
	},

	validate: function() {
		var valid = true;
		var name = $.trim(this.inputNameEl.val());
		if (name.length === 0) {
			valid = false;
			this.spanNameEl.html('Name cant be empty');
			this.spanNameEl.parent().addClass('error')
		} else {
			this.spanNameEl.html('');
			this.spanNameEl.parent().removeClass('error')
		}

		var funds = parseFloat(this.inputFundsEl.val());
		if (isNaN(funds)) {
			valid = false;
			this.spanFundsEl.html('Funds has to be a number');
			this.spanFundsEl.parent().addClass('error')
		} else {
			if (funds < 0) {
				valid = false;
				this.spanFundsEl.html('Funds has to be greater than zero');
				this.spanFundsEl.parent().addClass('error')
			} else {
				this.spanFundsEl.html('');
				this.spanFundsEl.parent().removeClass('error')	
			}
		}
		return valid;
	}
});
