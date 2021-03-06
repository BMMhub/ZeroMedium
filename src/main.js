// Zeroframe
var ZeroFrame = require("./ZeroFrame.js");

// Router
var Router = require("./router.js");

// Vue
var Vue = require("vue/dist/vue.min.js");
var VueZeroFrameRouter = require("./vue-zeroframe-router.js");

// Vue Components
require("./vue_components/navbar.js");
require("./vue_components/signin-modal.js");
require("./vue_components/story.js");
require("./vue_components/response.js");

var sanitizeHtml = require('sanitize-html');
var { sanitizeStringForUrl, sanitizeStringForUrl_SQL, html_substr } = require('./util.js');

Vue.use(VueZeroFrameRouter.VueZeroFrameRouter);

var app = new Vue({
    el: "#app",
    template: `
        <div>
            <custom-nav v-on:show-signin-modal="showSigninModal()" v-on:get-user-info="getUserInfo()" v-bind:user-info="userInfo" v-bind:shadow="navbarShadow"></custom-nav>
            <component ref="view" v-bind:is="currentView" v-on:show-signin-modal="showSigninModal()" v-on:navbar-shadow-on="navbarShadowOn()" v-on:navbar-shadow-off="navbarShadowOff()" v-on:get-user-info="getUserInfo()" v-bind:user-info="userInfo" v-bind:response-content="responseContent" v-on:set-response-content="setResponseContent"></component>
            <signin-modal v-model="signin_modal_active" v-on:get-user-info="getUserInfo()" v-if="signin_modal_active" v-bind:user-info="userInfo"></signin-modal>
        </div>
        `,
    data: {
        //page: null,
        currentView: null,
        siteInfo: null,
        userInfo: null,
        navbarShadow: false,
        signin_modal_active: false,
        responseContent: '' // Used to transfer content from small response box to fullscreen route
    },
    methods: {
        navbarShadowOn: function() {
            this.navbarShadow = true;
        },
        navbarShadowOff: function() {
            this.navbarShadow = false;
        },
        showSigninModal: function() {
            if (this.siteInfo == null) return;
            this.signin_modal_active = true;
        },
        closeSigninModal: function() {
            this.signin_modal_active = false;
        },
        getUserInfo: function() {
            if (this.siteInfo == null || this.siteInfo.cert_user_id == null) {
                this.userInfo = null;
                return;
            }

            var that = this;
            page.cmd('dbQuery', ['SELECT key, value FROM keyvalue LEFT JOIN json USING (json_id) WHERE cert_user_id="' + this.siteInfo.cert_user_id + '" AND directory="users/' + this.siteInfo.auth_address + '"'], (rows) => {
                var keyvalue = {};
                for (var i = 0; i < rows.length; i++) {
                    var row = rows[i];
                    keyvalue[row.key] = row.value;
                }
                if (!keyvalue.name || keyvalue.name == "") return;
                that.userInfo = {
                    cert_user_id: that.siteInfo.cert_user_id,
                    auth_address: that.siteInfo.auth_address,
                    keyvalue: keyvalue
                };

                this.$emit('setUserInfo', that.userInfo);
            });
        },
        setResponseContent: function(content) {
            this.responseContent = content;
        }
    }
});

class ZeroApp extends ZeroFrame {
    onOpenWebsocket() {
        this.cmd("siteInfo", {}, (site_info) => {
            this.site_info = site_info;
            app.siteInfo = this.site_info;
            app.getUserInfo();
        });
    }
    
    onRequest(cmd, message) {
        if (cmd == "setSiteInfo") {
            this.site_info = message.params;
            //app.from = this.site_info.auth_address;
            app.siteInfo = this.site_info;
            app.getUserInfo();
        }
        Router.listenForBack(cmd, message);
        if (message.params.event[0] == "file_done") {
            //getTags(true);
            if (Router.currentRoute == "" || Router.currentRoute == "search" || Router.currentRouter == "topic/:slug") {
                app.$refs.view.getStories();
            }
        }
        /*for (var i = 0; i < app.userInfo.keyvalue.length; i++) {
            console.log(app.userInfo.keyvalue[i]);
        }*/
    }
    
    selectUser(f = null) {
        this.cmd("certSelect", {accepted_domains: ["zeroid.bit", "kaffie.bit", "cryptoid.bit"]}, () => {
            // TODO: Will this work always?
            //app.getUserInfo();
            if (f != null && typeof f == 'function') f();
        });
        return false;
    }

    getTopics(f = null) {
        page.cmd('dbQuery', ['SELECT * FROM topics'], (topics) => {
            if (f != null && typeof f == 'function') f(topics);
        });
    }

    getUserProfileInfo(auth_address, getStoryList, getResponsesList, f = null) {
        var userProfileInfo = {};
        userProfileInfo["auth_address"] = auth_address;
        // Get Keyvalue data
        page.cmd('dbQuery', ['SELECT key, value, cert_user_id FROM keyvalue LEFT JOIN json USING (json_id) WHERE directory="users/' + auth_address + '"'], (rows) => {
            //console.log(rows); // TODO
            if (rows && rows.length > 0 && rows[0]) {
                userProfileInfo["cert_user_id"] = rows[0].cert_user_id;
            }
            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                if (row.key == 'name') userProfileInfo["name"] = row.value;
                if (row.key == 'about') userProfileInfo["about"] = row.value;
            }

            // Get stories
            if (getStoryList) {
                userProfileInfo["stories"] = [];
                page.cmd('dbQuery', ['SELECT story_id, title, slug, description, tags, date_updated, date_added, cert_user_id, directory FROM stories LEFT JOIN json USING (json_id) WHERE directory="users/' + auth_address + '" ORDER BY date_added DESC'], (stories) => {
                    userProfileInfo["stories"] = stories;

                    if (getResponsesList) {
                        userProfileInfo["responses"] = [];
                        page.cmd('dbQuery', ['SELECT * FROM responses LEFT JOIN json USING (json_id) WHERE directory="users/' + auth_address + '" ORDER BY date_added DESC'], (responses) => {
                            userProfileInfo["responses"] = responses;

                            if (f != null && typeof f == 'function') f(userProfileInfo);
                        });
                    } else {
                        if (f != null && typeof f == 'function') f(userProfileInfo);
                    }
                });
            } else if (getResponsesList) {
                userProfileInfo["responses"] = [];

                page.cmd('dbQuery', ['SELECT * FROM responses LEFT JOIN json USING (json_id) WHERE directory="users/' + auth_address + '" ORDER BY date_added DESC'], (responses) => {
                    userProfileInfo["responses"] = responses;

                    if (f != null && typeof f == 'function') f(userProfileInfo);
                });
            } else {
                if (f != null && typeof f == 'function') f(userProfileInfo);
            }
        });
    }

    sanitizeHtml(text) {
        return sanitizeHtml(text, {
            allowedTags: ['b', 'i', 'em', 'strong', 'u', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'div', 'blockquote', 'code', 'strike', 'ul', 'li', 'ol', 'nl', 'hr', 'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'span'],
            allowedAttributes: {
                'a': [ 'href', 'name', 'target', 'align' ],
                'img': [ 'src', 'align'],
                'div': [ 'align' ],
                'p': [ 'align' ],
                'h1': [ 'align' ],
                'h2': [ 'align' ],
                'h3': [ 'align' ],
                'h4': [ 'align' ],
                'h5': [ 'align' ],
                'h6': [ 'align' ],
                'strong': [ 'align' ],
                'u': [ 'align' ],
                'b': [ 'align' ],
                'i': [ 'align' ],
                'em': [ 'align' ],
                'pre': [ 'align' ],
                'code': [ 'align' ],
                'table': [ 'align' ]
            },
            allowedSchemesByTag: {
              img: [ 'data' ]
            }
        });
    }

    // TODO: Check that slug doesn't already exist, if so, add date at end (or ask user to customize)
    postStory(title, description, body, tags, f = null) {
        if (!app.userInfo || !app.userInfo.cert_user_id) {
            this.cmd("wrapperNotification", ["info", "Please login first."]);
            //page.selectUser(); // TODO: Check if user has data, if not, show the registration modal.
            return;
        }

        var data_inner_path = "data/users/" + app.userInfo.auth_address + "/data.json";
        var content_inner_path = "data/users/" + app.userInfo.auth_address + "/content.json";

        page.cmd('fileGet', {"inner_path": data_inner_path, "required": false}, (data) => {
            if (!data) {
                // TODO: Show registration modal.
                return;
            } else {
                data = JSON.parse(data);
            }

            if (!data["stories"]) data["stories"] = [];

            data["stories"].push({
                "story_id": app.userInfo.keyvalue["next_story_id"] || 1,
                "title": title,
                "slug": sanitizeStringForUrl(title),
                "description": description,
                "body": page.sanitizeHtml(body),
                "tags": tags,
                "date_added": Date.now()
            });

            if (!app.userInfo.keyvalue["next_story_id"] || app.userInfo.keyvalue["next_story_id"] == null) app.userInfo.keyvalue["next_story_id"] = 1;
            //console.log(app.userInfo.keyvalue);
            app.userInfo.keyvalue["next_story_id"]++;
            data["next_story_id"] = app.userInfo.keyvalue["next_story_id"];

            var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

            page.cmd('fileWrite', [data_inner_path, btoa(json_raw)], (res) => {
                if (res == "ok") {
                    page.cmd('siteSign', {"inner_path": content_inner_path}, (res) => {
                        if (f != null && typeof f == 'function') f();
                        page.cmd('sitePublish', {"inner_path": content_inner_path, "sign": false});
                    });
                }
            });
        });
    }

    editStory(story_id, title, description, body, tags, f = null) {
        if (!app.userInfo || !app.userInfo.cert_user_id) {
            this.cmd("wrapperNotification", ["info", "Please login first."]);
            //page.selectUser(); // TODO: Check if user has data, if not, show the registration modal.
            return;
        }

        var data_inner_path = "data/users/" + app.userInfo.auth_address + "/data.json";
        var content_inner_path = "data/users/" + app.userInfo.auth_address + "/content.json";

        page.cmd('fileGet', {"inner_path": data_inner_path, "required": false}, (data) => {
            if (!data) {
                // TODO: Error out
                console.log("ERROR");
                return;
            } else {
                data = JSON.parse(data);
            }

            if (!data["stories"]) {
                // TODO: Error out
                console.log("ERROR");
                return;
            }

            for (var i = 0; i < data["stories"].length; i++) {
                var story = data["stories"][i];
                if (story.story_id == story_id) {
                    story.title = title;
                    story.slug = sanitizeStringForUrl(title); // TODO: IFFY
                    story.body = page.sanitizeHtml(body);
                    story.tags = tags;
                    story.description = description;
                    story.date_updated = Date.now();
                    break;
                }
            }

            var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

            page.cmd('fileWrite', [data_inner_path, btoa(json_raw)], (res) => {
                if (res == "ok") {
                    page.cmd('siteSign', {"inner_path": content_inner_path}, (res) => {
                        if (f != null && typeof f == 'function') f();
                        page.cmd('sitePublish', {"inner_path": content_inner_path, "sign": false});
                    });
                }
            });
        });
    }

    deleteStory(story_id, f = null) {
        if (!app.userInfo || !app.userInfo.cert_user_id) {
            this.cmd("wrapperNotification", ["info", "Please login first."]);
            //page.selectUser(); // TODO: Check if user has data, if not, show the registration modal.
            return;
        }

        var data_inner_path = "data/users/" + app.userInfo.auth_address + "/data.json";
        var content_inner_path = "data/users/" + app.userInfo.auth_address + "/content.json";

        page.cmd('fileGet', {"inner_path": data_inner_path, "required": false}, (data) => {
            if (!data) {
                // TODO: Error out
                console.log("ERROR");
                return;
            } else {
                data = JSON.parse(data);
            }

            if (!data["stories"]) {
                // TODO: Error out
                console.log("ERROR");
                return;
            }

            for (var i = 0; i < data["stories"].length; i++) {
                var story = data["stories"][i];
                if (story.story_id == story_id) {
                    data["stories"].splice(i, 1);
                    break;
                }
            }

            var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

            page.cmd("wrapperConfirm", ["Are you sure?", "Delete"], (confirmed) =>{
                if (confirmed) {
                    page.cmd('fileWrite', [data_inner_path, btoa(json_raw)], (res) => {
                        if (res == "ok") {
                            page.cmd('siteSign', {"inner_path": content_inner_path}, (res) => {
                                if (f != null && typeof f == 'function') f();
                                page.cmd('sitePublish', {"inner_path": content_inner_path, "sign": false});
                            });
                        }
                    });
                }
            });
        });
    }

    getStory(auth_address, slug, f = null) {
        // TODO: If two stories have the same title, go with the oldest (ORDER BY ___)
        page.cmd('dbQuery', ['SELECT story_id, title, slug, description, body, tags, date_updated, date_added, value FROM stories LEFT JOIN json USING (json_id) LEFT JOIN keyvalue USING (json_id) WHERE directory="users/' + auth_address + '" AND slug="' + slug + '" AND key="name"'], (stories) => {
            if (!stories || stories.length == 0) {
                f(null);
                return;
            }
            if (f != null && typeof f == 'function') f(stories[0]);
        });
    }

    // Used to get story that a response is on (for showing the response on an author's profile)
    // This will only get the stories id, title, and slug
    getStoryMinimal(auth_address, story_id, f = null) {
        page.cmd('dbQuery', ['SELECT story_id, title, slug, directory, value FROM stories LEFT JOIN json USING (json_id) LEFT JOIN keyvalue USING (json_id) WHERE key="name" AND story_id=' + story_id + ' AND directory="users/' + auth_address + '"'], (stories) => {
            if (!stories || stories.length == 0) {
                f(null);
                return;
            }
            if (f != null && typeof f == 'function') f(stories[0]);
        });
    }

    // Make getExtra true to get claps and responses on the story (TODO: does not include the responses on the responses)
    getAllStories(getExtra, includeTestFunction, f = null) {
        page.cmd('dbQuery', ['SELECT * FROM stories LEFT JOIN json USING (json_id) LEFT JOIN keyvalue USING (json_id) WHERE key="name" ORDER BY date_added DESC'], (stories) => {
            var storiesToInclude = [];
            for (var i = 0; i < stories.length; i++) {
                let story = stories[i];
                let story_auth_address = story.directory.replace(/users\//, '').replace(/\//g, '');

                if (getExtra) {
                    if (i == stories.length - 1) {
                        page.getResponses(story_auth_address, story.story_id, "s", (responses) => {
                            story["responses"] = responses;

                            page.getClaps(story_auth_address, story.story_id, "s", (claps) => {
                                story["claps"] = claps;

                                if (includeTestFunction(story)) {
                                    storiesToInclude.push(story);
                                }
                                
                                if (f && typeof f == 'function') f(storiesToInclude);
                            });
                        });
                    } else {
                        page.getResponses(story_auth_address, story.story_id, "s", (responses) => {
                            story["responses"] = responses;

                            page.getClaps(story_auth_address, story.story_id, "s", (claps) => {
                                story["claps"] = claps;

                                if (includeTestFunction(story)) {
                                    storiesToInclude.push(story);
                                }
                            });
                        });
                    }
                } else {
                    if (includeTestFunction(story)) {
                        storiesToInclude.push(story);
                    }
                    if (i == stories.length - 1) {
                        if (f && typeof f == 'function') f(storiesToInclude);
                    }
                }
            }
        });
    }

    // Reference types:
    //  s - story
    //  r - response
    postResponse(reference_auth_address, reference_id, reference_type, body, f = null) {
        if (!app.userInfo || !app.userInfo.cert_user_id) {
            this.cmd("wrapperNotification", ["info", "Please login first."]);
            //page.selectUser(); // TODO: Check if user has data, if not, show the registration modal.
            return;
        }

        var data_inner_path = "data/users/" + app.userInfo.auth_address + "/data.json";
        var content_inner_path = "data/users/" + app.userInfo.auth_address + "/content.json";

        page.cmd('fileGet', {"inner_path": data_inner_path, "required": false}, (data) => {
            if (!data) {
                // TODO: Show registration modal.
                return;
            } else {
                data = JSON.parse(data);
            }

            if (!data["responses"]) data["responses"] = [];

            data["responses"].push({
                "response_id": app.userInfo.keyvalue["next_response_id"] || 1,
                "body": page.sanitizeHtml(body),
                "reference_id": reference_id,
                "reference_auth_address": reference_auth_address,
                "reference_type": reference_type,
                "date_added": Date.now()
            });

            if (!app.userInfo.keyvalue["next_response_id"] || app.userInfo.keyvalue["next_response_id"] == null) app.userInfo.keyvalue["next_response_id"] = 1;
            app.userInfo.keyvalue["next_response_id"]++;
            data["next_response_id"] = app.userInfo.keyvalue["next_response_id"];

            var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

            page.cmd('fileWrite', [data_inner_path, btoa(json_raw)], (res) => {
                if (res == "ok") {
                    page.cmd('siteSign', {"inner_path": content_inner_path}, (res) => {
                        if (f != null && typeof f == 'function') f();
                        page.cmd('sitePublish', {"inner_path": content_inner_path, "sign": false});
                    });
                }
            });
        });
    }

    getResponses(reference_auth_address, reference_id, reference_type, f) {
        page.cmd('dbQuery', ['SELECT * FROM responses LEFT JOIN json USING (json_id) LEFT JOIN keyvalue USING (json_id) WHERE reference_auth_address="' + reference_auth_address + '" AND reference_id=' + reference_id + ' AND reference_type="' + reference_type + '" AND key="name" ORDER BY date_added DESC'], f);
    }

    getResponse(auth_address, response_id, f) {
        page.cmd('dbQuery', ['SELECT * FROM responses LEFT JOIN json USING (json_id) LEFT JOIN keyvalue USING (json_id) WHERE key="name" AND directory="users/' + auth_address + '" AND response_id=' + response_id + " LIMIT 1"], (responses) => {
            var response = responses[0];
            page.cmd('dbQuery', ['SELECT * FROM stories LEFT JOIN json USING (json_id) LEFT JOIN keyvalue USING (json_id) WHERE key="name" AND directory="users/' + response.reference_auth_address + '" AND story_id=' + response.reference_id + " LIMIT 1"], (stories) => {
                response["story"] = stories[0];
                if (f != null && typeof f == 'function') f(response);
            });
        });
    }

    // Reference Types:
    //  s - story
    //  r - response
    postClap(reference_auth_address, reference_id, reference_type, f = null) {
        if (!app.userInfo || !app.userInfo.cert_user_id) {
            this.cmd("wrapperNotification", ["info", "Please login first."]);
            //page.selectUser(); // TODO: Check if user has data, if not, show the registration modal.
            return;
        }

        var data_inner_path = "data/users/" + app.userInfo.auth_address + "/data.json";
        var content_inner_path = "data/users/" + app.userInfo.auth_address + "/content.json";

        page.cmd('fileGet', {"inner_path": data_inner_path, "required": false}, (data) => {
            if (!data) {
                // TODO: Show registration modal.
                return;
            } else {
                data = JSON.parse(data);
            }

            if (!data["claps"]) data["claps"] = [];

            var alreadyVoted = false;
            var voteIndex = null;
            for (var i = 0; i < data.claps.length; i++) {
                if (data.claps[i].reference_id == reference_id && data.claps[i].reference_auth_address == reference_auth_address) {
                    alreadyVoted = true;
                    voteIndex = i;
                    break;
                }
            }

            if (alreadyVoted) {
                if (data.claps[voteIndex].number == 0) {
                    data.claps[voteIndex].number = 1;
                    data.claps[voteIndex].date_added = Date.now();
                } else {
                    data.claps[voteIndex].number = 0;
                }
                /*if (data.claps[voteIndex].number < 0 && downvote) {
                    data.claps[voteIndex].number = 0;
                } else if (data.claps[voteIndex].number > 0 && !downvote) {
                    data.claps[voteIndex].number = 0;
                } else if (data.claps[voteIndex].number >= 0 && downvote) {
                    data.claps[voteIndex].number = -1;
                } else if (data.claps[voteIndex].number <= 0 && !downvote) {
                    data.claps[voteIndex].number = 1;
                }*/
            } else {
                data.claps.push({
                    "clap_id": app.userInfo.keyvalue["next_clap_id"] || 1,
                    "reference_auth_address": reference_auth_address,
                    "reference_id": reference_id,
                    "reference_type": reference_type,
                    "number": 1,
                    "date_added": Date.now()
                });

                if (!app.userInfo.keyvalue["next_clap_id"] || app.userInfo.keyvalue["next_clap_id"] == null) app.userInfo.keyvalue["next_clap_id"] = 1;
                app.userInfo.keyvalue["next_clap_id"]++;
                data["next_clap_id"] = app.userInfo.keyvalue["next_clap_id"];
            }

            var json_raw = unescape(encodeURIComponent(JSON.stringify(data, undefined, '\t')));

            page.cmd('fileWrite', [data_inner_path, btoa(json_raw)], (res) => {
                if (res == "ok") {
                    page.cmd('siteSign', {"inner_path": content_inner_path}, (res) => {
                        if (f != null && typeof f == 'function') f();
                        page.cmd('sitePublish', {"inner_path": content_inner_path, "sign": false});
                    });
                }
            });
        });
    }

    getClaps(reference_auth_address, reference_id, reference_type, f) {
        page.cmd('dbQuery', ['SELECT * FROM claps LEFT JOIN json USING (json_id) LEFT JOIN keyvalue USING (json_id) WHERE reference_auth_address="' + reference_auth_address + '" AND reference_id=' + reference_id + ' AND reference_type="' + reference_type + '" AND key="name" ORDER BY date_added DESC'], f);
    }

    getUserClaps(auth_address, f) {
        page.cmd('dbQuery', ['SELECT number, reference_auth_address, reference_id, reference_type FROM claps LEFT JOIN json USING (json_id) WHERE directory="users/' + auth_address + '" AND number=1 ORDER BY date_added DESC'], (claps) => {
            var newClaps = [];

            for (var i = 0; i < claps.length; i++) {
                let clap = claps[i]; // Don't use var, otherwise the lambda's will use the same value for this (because var is function scope, not block scope and because javascript is dumb).
                if (clap.reference_type == "s") {
                    if (i == claps.length - 1) { // If last clap
                        page.cmd('dbQuery', ['SELECT story_id, description, slug, title, date_updated, date_added, directory, value FROM stories LEFT JOIN json USING (json_id) LEFT JOIN keyvalue USING (json_id) WHERE key="name" AND story_id=' + clap.reference_id + ' AND directory="users/' + clap.reference_auth_address + '"'], (story) => {
                            clap["story"] = story[0];
                            newClaps.push(clap);

                            if (typeof f == 'function') f(newClaps);
                        });
                    } else {
                        page.cmd('dbQuery', ['SELECT story_id, description, slug, title, date_updated, date_added, directory, value FROM stories LEFT JOIN json USING (json_id) LEFT JOIN keyvalue USING (json_id) WHERE key="name" AND story_id=' + clap.reference_id + ' AND directory="users/' + clap.reference_auth_address + '"'], (story) => {
                            clap["story"] = story[0];

                            newClaps.push(clap);
                        });
                    }
                }
            }
        });
    }

    getUsers(f) {
        page.cmd('dbQuery', ['SELECT * FROM keyvalue LEFT JOIN json USING (json_id) WHERE key="name"'], f);
    }

    unimplemented() {
        page.cmd("wrapperNotification", ["info", "Unimplemented!"]);
    }
}

page = new ZeroApp();

// Router Pages
var Home = require("./router_pages/home.js");

var Search = require("./router_pages/search.js");

var TopicSlug = require("./router_pages/topic_slug.js");
var TagSlug = require("./router_pages/tag_slug.js");

var Newstory = require("./router_pages/newstory.js");
var EditStory = require("./router_pages/edit_story.js");
var ResponseFullscreenEditor = require('./router_pages/response_fullscreen_editor.js');

var MeSettings = require("./router_pages/me_settings.js");
var MeStories = require("./router_pages/me_stories.js");
var Profile = require("./router_pages/profile.js");
var ResponseFullscreen = require('./router_pages/response_fullscreen.js');
var ProfileStory = require("./router_pages/profile_story.js");

VueZeroFrameRouter.VueZeroFrameRouter_Init(Router, app, [
    { route: 'search', component: Search },
    { route: 'topic/:slug', component: TopicSlug },
    { route: 'tag/:slug', component: TagSlug },
    { route: 'me/settings', component: MeSettings },
    { route: 'me/newstory', component: Newstory },
    { route: 'me/stories/:slug/edit', component: EditStory },
    { route: 'me/stories', component: MeStories },
    { route: ':userauthaddress/response/:id/response', component: ResponseFullscreenEditor },
    { route: ':userauthaddress/:slug/response', component: ResponseFullscreenEditor },
    { route: ':userauthaddress/response/:id', component: ResponseFullscreen },
    { route: ':userauthaddress/:slug', component: ProfileStory },
    { route: ':userauthaddress', component: Profile }, // TODO: Have tabs use '&tab='
    { route: '', component: Home }
]);
