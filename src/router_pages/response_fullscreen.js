var Vue = require("vue/dist/vue.min.js");
var Router = require("../router.js");

var ResponseFullscreen = {
	props: ["userInfo"],
	data: function() {
		return {
			editor: null,
			title: '',
			status: 'Unsaved changes',
			mobileTags: '',
			mobileDescription: ''
		}
	},
	beforeMount: function() {
		this.$emit('navbar-shadow-off');
	},
	mounted: function() {
		this.editor = new MediumEditor('.editable', {
			placeholder: {
				text: "Tell your story...",
				hideOnClick: false
			},
			toolbar: {
				buttons: ['bold', 'italic', 'underline', 'anchor', 'h2', 'h3', 'unorderedlist', 'quote'] // Got rid of 'quote'
			},
			buttonLabels: "fontawesome",
			anchor: {
		        customClassOption: null,
		        customClassOptionText: 'Button',
		        linkValidation: false,
		        placeholderText: 'Paste or type a link',
		        targetCheckbox: false,
		        targetCheckboxText: 'Open in new window'
		    },
		    autoLink: true
		});
	},
	methods: {
		publish: function(tags, description) {
			var that = this;
			page.postStory(this.title, description, this.editor.getContent(), tags, function() {
				Router.navigate(that.userInfo.auth_address + '/' + sanitizeStringForUrl(that.title));
			});
		},
		save: function(tags, description) {
			page.unimplemented();
		}
	},
	template: `
		<div>
			<response-editor-nav v-on:publish="publish" v-on:save="save">
				<span slot="status">{{status}}</span>
			</response-editor-nav>
			<section class="section">
				<div class="columns is-centered">
					<div class="column is-three-quarters-tablet is-half-desktop">
						<!--<input class="input title" type="text" placeholder="Title" style="border: none; border-left: 1px solid #CCCCCC; background: inherit; box-shadow: none;" v-model="title">-->
						<!--<textarea class="textarea" style="border: none; background: inherit; box-shadow: none;"></textarea>-->
						<div class="editable content"></div>
					</div>
				</div>
			</section>
		</div>
		`
};

Vue.component('response-editor-nav', {
	props: ['value'],
	methods: {
		publish: function() {
			this.$emit('publish');
		},
		save: function() {
			this.$emit('save');
		}
	},
	template: `
		<div>
			<div class="navbar is-transparent has-shadow" style="border-top: 1px solid rgba(0,0,0,.05);">
	            <div class="container">
	            	<div class="navbar-brand">
	                	<div class="navbar-item"><slot>Draft</slot></div>
	                	<div class="navbar-item" style="padding-left: 5px; padding-right: 5px; color: #9A9A9A;"><small><slot name="status">Unsaved changes</slot><small></div>
	                </div>
	                <div class="navbar-menu">
	                	<div class="navbar-start">
	                	</div>
	                	<div class="navbar-end">
	                		<a class="navbar-item" v-on:click.prevent="save">Save Draft</a>
	                		<a class="navbar-item" v-on:click.prevent="publish">Publish</a>
	                	</div>
	                </div>
	            </div>
	        </div>
	        <div class="columns is-centered is-hidden-desktop">
				<div class="column is-three-quarters-tablet is-half-desktop" style="margin-top: 20px;">
	        		<a class="button is-outlined is-info is-small" v-on:click.prevent="save">Save Draft</a>
					<a class="button is-primary is-outlined is-small" v-on:click.prevent="publish">Publish</a>
				</div>
	        </div>
        </div>`
});

module.exports = ResponseFullscreen;