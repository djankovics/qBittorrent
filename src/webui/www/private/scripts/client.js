/*
 * MIT License
 * Copyright (c) 2008 Ishan Arora <ishan@qbittorrent.org>,
 * Christophe Dumez <chris@qbittorrent.org>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

'use strict';

this.torrentsTable = new TorrentsTable();
const torrentTrackersTable = new TorrentTrackersTable();
const torrentPeersTable = new TorrentPeersTable();
const torrentFilesTable = new TorrentFilesTable();
const searchResultsTable = new SearchResultsTable();
const searchPluginsTable = new SearchPluginsTable();

let updatePropertiesPanel = function() {};

let updateTorrentData = function() {};
let updateTrackersData = function() {};
let updateTorrentPeersData = function() {};
let updateWebSeedsData = function() {};
let updateTorrentFilesData = function() {};

this.updateMainData = function() {};
let alternativeSpeedLimits = false;
let queueing_enabled = true;
let serverSyncMainDataInterval = 1500;
let customSyncMainDataInterval = null;
let searchTabInitialized = false;

let clipboardEvent;

const CATEGORIES_ALL = 1;
const CATEGORIES_UNCATEGORIZED = 2;

let category_list = {};

let selected_category = CATEGORIES_ALL;
let setCategoryFilter = function() {};

const TAGS_ALL = 1;
const TAGS_UNTAGGED = 2;

let tagList = {};

let selectedTag = TAGS_ALL;
let setTagFilter = function() {};

let selected_filter = getLocalStorageItem('selected_filter', 'all');
let setFilter = function() {};
let toggleFilterDisplay = function() {};

const loadSelectedCategory = function() {
    selected_category = getLocalStorageItem('selected_category', CATEGORIES_ALL);
};
loadSelectedCategory();

const loadSelectedTag = function() {
    selectedTag = getLocalStorageItem('selected_tag', TAGS_ALL);
};
loadSelectedTag();

function genHash(string) {
    let hash = 0;
    for (let i = 0; i < string.length; ++i) {
        const c = string.charCodeAt(i);
        hash = (c + hash * 31) | 0;
    }
    return hash;
}

function getSyncMainDataInterval() {
    return customSyncMainDataInterval ? customSyncMainDataInterval : serverSyncMainDataInterval;
}

const fetchQbtVersion = function() {
    new Request({
        url: 'api/v2/app/version',
        method: 'get',
        onSuccess: function(info) {
            if (!info) return;
            sessionStorage.setItem('qbtVersion', info);
        }
    }).send();
};
fetchQbtVersion();

const qbtVersion = function() {
    const version = sessionStorage.getItem('qbtVersion');
    if (!version)
        return '';
    return version;
};

window.addEvent('load', function() {

    const saveColumnSizes = function() {
        const filters_width = $('Filters').getSize().x;
        const properties_height_rel = $('propertiesPanel').getSize().y / Window.getSize().y;
        localStorage.setItem('filters_width', filters_width);
        localStorage.setItem('properties_height_rel', properties_height_rel);
    };

    window.addEvent('resize', function() {
        // only save sizes if the columns are visible
        if (!$("mainColumn").hasClass("invisible"))
            saveColumnSizes.delay(200); // Resizing might takes some time.
    });

    /*MochaUI.Desktop = new MochaUI.Desktop();
    MochaUI.Desktop.desktop.setStyles({
        'background': '#fff',
        'visibility': 'visible'
    });*/
    MochaUI.Desktop.initialize();

    const buildTransfersTab = function() {
        let filt_w = localStorage.getItem('filters_width');
        if ($defined(filt_w))
            filt_w = filt_w.toInt();
        else
            filt_w = 120;
        new MochaUI.Column({
            id: 'filtersColumn',
            placement: 'left',
            onResize: saveColumnSizes,
            width: filt_w,
            resizeLimit: [1, 300]
        });

        new MochaUI.Column({
            id: 'mainColumn',
            placement: 'main'
        });
    };

    const buildSearchTab = function() {
        new MochaUI.Column({
            id: 'searchTabColumn',
            placement: 'main',
            width: null
        });

        // start off hidden
        $("searchTabColumn").addClass("invisible");
    };

    buildTransfersTab();
    buildSearchTab();
    MochaUI.initializeTabs('mainWindowTabsList');

    setCategoryFilter = function(hash) {
        selected_category = hash;
        localStorage.setItem('selected_category', selected_category);
        highlightSelectedCategory();
        if (typeof torrentsTable.tableBody != 'undefined')
            updateMainData();
    };

    setTagFilter = function(hash) {
        selectedTag = hash.toString();
        localStorage.setItem('selected_tag', selectedTag);
        highlightSelectedTag();
        if (torrentsTable.tableBody !== undefined)
            updateMainData();
    };

    setFilter = function(f) {
        // Visually Select the right filter
        $("all_filter").removeClass("selectedFilter");
        $("downloading_filter").removeClass("selectedFilter");
        $("seeding_filter").removeClass("selectedFilter");
        $("completed_filter").removeClass("selectedFilter");
        $("paused_filter").removeClass("selectedFilter");
        $("resumed_filter").removeClass("selectedFilter");
        $("active_filter").removeClass("selectedFilter");
        $("inactive_filter").removeClass("selectedFilter");
        $("errored_filter").removeClass("selectedFilter");
        $(f + "_filter").addClass("selectedFilter");
        selected_filter = f;
        localStorage.setItem('selected_filter', f);
        // Reload torrents
        if (typeof torrentsTable.tableBody != 'undefined')
            updateMainData();
    };

    toggleFilterDisplay = function(filter) {
        const element = filter + "FilterList";
        localStorage.setItem('filter_' + filter + "_collapsed", !$(element).hasClass("invisible"));
        $(element).toggleClass("invisible")
        const parent = $(element).getParent(".filterWrapper");
        const toggleIcon = $(parent).getChildren(".filterTitle img");
        if (toggleIcon)
            toggleIcon[0].toggleClass("rotate");
    };

    new MochaUI.Panel({
        id: 'Filters',
        title: 'Panel',
        header: false,
        padding: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
        },
        loadMethod: 'xhr',
        contentURL: 'filters.html',
        onContentLoaded: function() {
            setFilter(selected_filter);
        },
        column: 'filtersColumn',
        height: 300
    });
    initializeWindows();

    // Show Top Toolbar is enabled by default
    let showTopToolbar = true;
    if (localStorage.getItem('show_top_toolbar') !== null)
        showTopToolbar = localStorage.getItem('show_top_toolbar') == "true";
    if (!showTopToolbar) {
        $('showTopToolbarLink').firstChild.style.opacity = '0';
        $('mochaToolbar').addClass('invisible');
    }

    // Show Status Bar is enabled by default
    let showStatusBar = true;
    if (localStorage.getItem('show_status_bar') !== null)
        showStatusBar = localStorage.getItem('show_status_bar') === "true";
    if (!showStatusBar) {
        $('showStatusBarLink').firstChild.style.opacity = '0';
        $('desktopFooterWrapper').addClass('invisible');
    }

    let speedInTitle = localStorage.getItem('speed_in_browser_title_bar') == "true";
    if (!speedInTitle)
        $('speedInBrowserTitleBarLink').firstChild.style.opacity = '0';

    // After showing/hiding the toolbar + status bar
    let showSearchEngine = localStorage.getItem('show_search_engine') !== "false";
    if (!showSearchEngine) {
        // uncheck menu option
        $('showSearchEngineLink').firstChild.style.opacity = '0';
        // hide tabs
        $('mainWindowTabs').addClass('invisible');
    }

    // After Show Top Toolbar
    MochaUI.Desktop.setDesktopSize();

    let syncMainDataLastResponseId = 0;
    const serverState = {};

    const removeTorrentFromCategoryList = function(hash) {
        if (hash === null || hash === "")
            return false;
        let removed = false;
        Object.each(category_list, function(category) {
            if (Object.contains(category.torrents, hash)) {
                removed = true;
                category.torrents.splice(category.torrents.indexOf(hash), 1);
            }
        });
        return removed;
    };

    const addTorrentToCategoryList = function(torrent) {
        const category = torrent['category'];
        if (typeof category === 'undefined')
            return false;
        if (category.length === 0) { // Empty category
            removeTorrentFromCategoryList(torrent['hash']);
            return true;
        }
        const categoryHash = genHash(category);
        if (category_list[categoryHash] === null) // This should not happen
            category_list[categoryHash] = {
                name: category,
                torrents: []
            };
        if (!Object.contains(category_list[categoryHash].torrents, torrent['hash'])) {
            removeTorrentFromCategoryList(torrent['hash']);
            category_list[categoryHash].torrents = category_list[categoryHash].torrents.combine([torrent['hash']]);
            return true;
        }
        return false;
    };

    const removeTorrentFromTagList = function(hash) {
        if ((hash === null) || (hash === ""))
            return false;

        let removed = false;
        for (const key in tagList) {
            const tag = tagList[key];
            if (Object.contains(tag.torrents, hash)) {
                removed = true;
                tag.torrents.splice(tag.torrents.indexOf(hash), 1);
            }
        }
        return removed;
    };

    const addTorrentToTagList = function(torrent) {
        if (torrent['tags'] === undefined) // Tags haven't changed
            return false;

        removeTorrentFromTagList(torrent['hash']);

        if (torrent['tags'].length === 0) // No tags
            return true;

        const tags = torrent['tags'].split(',');
        let added = false;
        for (let i = 0; i < tags.length; ++i) {
            const tagHash = genHash(tags[i].trim());
            if (!Object.contains(tagList[tagHash].torrents, torrent['hash'])) {
                added = true;
                tagList[tagHash].torrents.push(torrent['hash']);
            }
        }
        return added;
    };

    const updateFilter = function(filter, filterTitle) {
        $(filter + '_filter').firstChild.childNodes[1].nodeValue = filterTitle.replace('%1', torrentsTable.getFilteredTorrentsNumber(filter, CATEGORIES_ALL, TAGS_ALL));
    };

    const updateFiltersList = function() {
        updateFilter('all', 'QBT_TR(All (%1))QBT_TR[CONTEXT=StatusFilterWidget]');
        updateFilter('downloading', 'QBT_TR(Downloading (%1))QBT_TR[CONTEXT=StatusFilterWidget]');
        updateFilter('seeding', 'QBT_TR(Seeding (%1))QBT_TR[CONTEXT=StatusFilterWidget]');
        updateFilter('completed', 'QBT_TR(Completed (%1))QBT_TR[CONTEXT=StatusFilterWidget]');
        updateFilter('resumed', 'QBT_TR(Resumed (%1))QBT_TR[CONTEXT=StatusFilterWidget]');
        updateFilter('paused', 'QBT_TR(Paused (%1))QBT_TR[CONTEXT=StatusFilterWidget]');
        updateFilter('active', 'QBT_TR(Active (%1))QBT_TR[CONTEXT=StatusFilterWidget]');
        updateFilter('inactive', 'QBT_TR(Inactive (%1))QBT_TR[CONTEXT=StatusFilterWidget]');
        updateFilter('errored', 'QBT_TR(Errored (%1))QBT_TR[CONTEXT=StatusFilterWidget]');
    };

    const updateCategoryList = function() {
        const categoryList = $('categoryFilterList');
        if (!categoryList)
            return;
        categoryList.empty();

        const create_link = function(hash, text, count) {
            const html = '<a href="#" onclick="setCategoryFilter(' + hash + ');return false;">'
                + '<img src="images/qbt-theme/inode-directory.svg"/>'
                + escapeHtml(text) + ' (' + count + ')' + '</a>';
            const el = new Element('li', {
                id: hash,
                html: html
            });
            categoriesFilterContextMenu.addTarget(el);
            return el;
        };

        const all = torrentsTable.getRowIds().length;
        let uncategorized = 0;
        Object.each(torrentsTable.rows, function(row) {
            if (row['full_data'].category.length === 0)
                uncategorized += 1;
        });
        categoryList.appendChild(create_link(CATEGORIES_ALL, 'QBT_TR(All)QBT_TR[CONTEXT=CategoryFilterModel]', all));
        categoryList.appendChild(create_link(CATEGORIES_UNCATEGORIZED, 'QBT_TR(Uncategorized)QBT_TR[CONTEXT=CategoryFilterModel]', uncategorized));

        const sortedCategories = [];
        Object.each(category_list, function(category) {
            sortedCategories.push(category.name);
        });
        sortedCategories.sort();

        Object.each(sortedCategories, function(categoryName) {
            const categoryHash = genHash(categoryName);
            const categoryCount = category_list[categoryHash].torrents.length;
            categoryList.appendChild(create_link(categoryHash, categoryName, categoryCount));
        });

        highlightSelectedCategory();
    };

    const highlightSelectedCategory = function() {
        const categoryList = $('categoryFilterList');
        if (!categoryList)
            return;
        const children = categoryList.childNodes;
        for (let i = 0; i < children.length; ++i) {
            if (children[i].id == selected_category)
                children[i].className = "selectedFilter";
            else
                children[i].className = "";
        }
    };

    const updateTagList = function() {
        const tagFilterList = $('tagFilterList');
        if (tagFilterList === null)
            return;

        while (tagFilterList.firstChild !== null)
            tagFilterList.removeChild(tagFilterList.firstChild);

        const createLink = function(hash, text, count) {
            const html = '<a href="#" onclick="setTagFilter(' + hash + ');return false;">'
                + '<img src="images/qbt-theme/inode-directory.svg"/>'
                + escapeHtml(text) + ' (' + count + ')' + '</a>';
            const el = new Element('li', {
                id: hash,
                html: html
            });
            tagsFilterContextMenu.addTarget(el);
            return el;
        };

        const torrentsCount = torrentsTable.getRowIds().length;
        let untagged = 0;
        for (const key in torrentsTable.rows) {
            if (torrentsTable.rows.hasOwnProperty(key) && torrentsTable.rows[key]['full_data'].tags.length === 0)
                untagged += 1;
        }
        tagFilterList.appendChild(createLink(TAGS_ALL, 'QBT_TR(All)QBT_TR[CONTEXT=TagFilterModel]', torrentsCount));
        tagFilterList.appendChild(createLink(TAGS_UNTAGGED, 'QBT_TR(Untagged)QBT_TR[CONTEXT=TagFilterModel]', untagged));

        const sortedTags = [];
        for (const key in tagList)
            sortedTags.push(tagList[key].name);
        sortedTags.sort();

        for (let i = 0; i < sortedTags.length; ++i) {
            const tagName = sortedTags[i];
            const tagHash = genHash(tagName);
            const tagCount = tagList[tagHash].torrents.length;
            tagFilterList.appendChild(createLink(tagHash, tagName, tagCount));
        }

        highlightSelectedTag();
    };

    const highlightSelectedTag = function() {
        const tagFilterList = $('tagFilterList');
        if (!tagFilterList)
            return;

        const children = tagFilterList.childNodes;
        for (let i = 0; i < children.length; ++i)
            children[i].className = (children[i].id === selectedTag) ? "selectedFilter" : "";
    };

    let syncMainDataTimer;
    const syncMainData = function() {
        const url = new URI('api/v2/sync/maindata');
        url.setData('rid', syncMainDataLastResponseId);
        new Request.JSON({
            url: url,
            noCache: true,
            method: 'get',
            onFailure: function() {
                const errorDiv = $('error_div');
                if (errorDiv)
                    errorDiv.set('html', 'QBT_TR(qBittorrent client is not reachable)QBT_TR[CONTEXT=HttpServer]');
                clearTimeout(syncMainDataTimer);
                syncMainDataTimer = syncMainData.delay(2000);
            },
            onSuccess: function(response) {
                $('error_div').set('html', '');
                if (response) {
                    clearTimeout(torrentsFilterInputTimer);
                    let torrentsTableSelectedRows;
                    let update_categories = false;
                    let updateTags = false;
                    const full_update = (response['full_update'] === true);
                    if (full_update) {
                        torrentsTableSelectedRows = torrentsTable.selectedRowsIds();
                        torrentsTable.clear();
                        category_list = {};
                        tagList = {};
                    }
                    if (response['rid']) {
                        syncMainDataLastResponseId = response['rid'];
                    }
                    if (response['categories']) {
                        for (const key in response['categories']) {
                            const category = response['categories'][key];
                            const categoryHash = genHash(key);
                            if (category_list[categoryHash] !== undefined) {
                                // only the save path can change for existing categories
                                category_list[categoryHash].savePath = category.savePath;
                            }
                            else {
                                category_list[categoryHash] = {
                                    name: category.name,
                                    savePath: category.savePath,
                                    torrents: []
                                };
                            }
                        }
                        update_categories = true;
                    }
                    if (response['categories_removed']) {
                        response['categories_removed'].each(function(category) {
                            const categoryHash = genHash(category);
                            delete category_list[categoryHash];
                        });
                        update_categories = true;
                    }
                    if (response['tags']) {
                        for (const tag of response['tags']) {
                            const tagHash = genHash(tag);
                            if (!tagList[tagHash]) {
                                tagList[tagHash] = {
                                    name: tag,
                                    torrents: []
                                };
                            }
                        }
                        updateTags = true;
                    }
                    if (response['tags_removed']) {
                        for (let i = 0; i < response['tags_removed'].length; ++i) {
                            const tagHash = genHash(response['tags_removed'][i]);
                            delete tagList[tagHash];
                        }
                        updateTags = true;
                    }
                    if (response['torrents']) {
                        let updateTorrentList = false;
                        for (const key in response['torrents']) {
                            response['torrents'][key]['hash'] = key;
                            response['torrents'][key]['rowId'] = key;
                            if (response['torrents'][key]['state'])
                                response['torrents'][key]['status'] = response['torrents'][key]['state'];
                            torrentsTable.updateRowData(response['torrents'][key]);
                            if (addTorrentToCategoryList(response['torrents'][key]))
                                update_categories = true;
                            if (addTorrentToTagList(response['torrents'][key]))
                                updateTags = true;
                            if (response['torrents'][key]['name'])
                                updateTorrentList = true;
                        }

                        if (updateTorrentList)
                            setupCopyEventHandler();
                    }
                    if (response['torrents_removed'])
                        response['torrents_removed'].each(function(hash) {
                            torrentsTable.removeRow(hash);
                            removeTorrentFromCategoryList(hash);
                            update_categories = true; // Always to update All category
                            removeTorrentFromTagList(hash);
                            updateTags = true; // Always to update All tag
                        });
                    torrentsTable.updateTable(full_update);
                    torrentsTable.altRow();
                    if (response['server_state']) {
                        const tmp = response['server_state'];
                        for (const k in tmp)
                            serverState[k] = tmp[k];
                        processServerState();
                    }
                    updateFiltersList();
                    if (update_categories) {
                        updateCategoryList();
                        torrentsTableContextMenu.updateCategoriesSubMenu(category_list);
                    }
                    if (updateTags) {
                        updateTagList();
                        torrentsTableContextMenu.updateTagsSubMenu(tagList);
                    }

                    if (full_update)
                        // re-select previously selected rows
                        torrentsTable.reselectRows(torrentsTableSelectedRows);
                }
                clearTimeout(syncMainDataTimer);
                syncMainDataTimer = syncMainData.delay(getSyncMainDataInterval());
            }
        }).send();
    };

    updateMainData = function() {
        torrentsTable.updateTable();
        clearTimeout(syncMainDataTimer);
        syncMainDataTimer = syncMainData.delay(100);
    };

    const processServerState = function() {
        let transfer_info = friendlyUnit(serverState.dl_info_speed, true);
        if (serverState.dl_rate_limit > 0)
            transfer_info += " [" + friendlyUnit(serverState.dl_rate_limit, true) + "]";
        transfer_info += " (" + friendlyUnit(serverState.dl_info_data, false) + ")";
        $("DlInfos").set('html', transfer_info);
        transfer_info = friendlyUnit(serverState.up_info_speed, true);
        if (serverState.up_rate_limit > 0)
            transfer_info += " [" + friendlyUnit(serverState.up_rate_limit, true) + "]";
        transfer_info += " (" + friendlyUnit(serverState.up_info_data, false) + ")";
        $("UpInfos").set('html', transfer_info);
        if (speedInTitle) {
            document.title = "QBT_TR([D: %1, U: %2] qBittorrent %3)QBT_TR[CONTEXT=MainWindow]".replace("%1", friendlyUnit(serverState.dl_info_speed, true)).replace("%2", friendlyUnit(serverState.up_info_speed, true)).replace("%3", qbtVersion());
            document.title += " QBT_TR(Web UI)QBT_TR[CONTEXT=OptionsDialog]";
        }
        else
            document.title = ("qBittorrent " + qbtVersion() + " QBT_TR(Web UI)QBT_TR[CONTEXT=OptionsDialog]");
        $('freeSpaceOnDisk').set('html', 'QBT_TR(Free space: %1)QBT_TR[CONTEXT=HttpServer]'.replace("%1", friendlyUnit(serverState.free_space_on_disk)));
        $('DHTNodes').set('html', 'QBT_TR(DHT: %1 nodes)QBT_TR[CONTEXT=StatusBar]'.replace("%1", serverState.dht_nodes));

        // Statistics dialog
        if (document.getElementById("statisticspage")) {
            $('AlltimeDL').set('html', friendlyUnit(serverState.alltime_dl, false));
            $('AlltimeUL').set('html', friendlyUnit(serverState.alltime_ul, false));
            $('TotalWastedSession').set('html', friendlyUnit(serverState.total_wasted_session, false));
            $('GlobalRatio').set('html', serverState.global_ratio);
            $('TotalPeerConnections').set('html', serverState.total_peer_connections);
            $('ReadCacheHits').set('html', serverState.read_cache_hits + "%");
            $('TotalBuffersSize').set('html', friendlyUnit(serverState.total_buffers_size, false));
            $('WriteCacheOverload').set('html', serverState.write_cache_overload + "%");
            $('ReadCacheOverload').set('html', serverState.read_cache_overload + "%");
            $('QueuedIOJobs').set('html', serverState.queued_io_jobs);
            $('AverageTimeInQueue').set('html', serverState.average_time_queue + " ms");
            $('TotalQueuedSize').set('html', friendlyUnit(serverState.total_queued_size, false));
        }

        if (serverState.connection_status == "connected")
            $('connectionStatus').src = 'images/skin/connected.svg';
        else if (serverState.connection_status == "firewalled")
            $('connectionStatus').src = 'images/skin/firewalled.svg';
        else
            $('connectionStatus').src = 'images/skin/disconnected.svg';

        if (queueing_enabled != serverState.queueing) {
            queueing_enabled = serverState.queueing;
            torrentsTable.columns['priority'].force_hide = !queueing_enabled;
            torrentsTable.updateColumn('priority');
            if (queueing_enabled) {
                $('topQueuePosItem').removeClass('invisible');
                $('increaseQueuePosItem').removeClass('invisible');
                $('decreaseQueuePosItem').removeClass('invisible');
                $('bottomQueuePosItem').removeClass('invisible');
                $('queueingButtons').removeClass('invisible');
                $('queueingMenuItems').removeClass('invisible');
            }
            else {
                $('topQueuePosItem').addClass('invisible');
                $('increaseQueuePosItem').addClass('invisible');
                $('decreaseQueuePosItem').addClass('invisible');
                $('bottomQueuePosItem').addClass('invisible');
                $('queueingButtons').addClass('invisible');
                $('queueingMenuItems').addClass('invisible');
            }
        }

        if (alternativeSpeedLimits != serverState.use_alt_speed_limits) {
            alternativeSpeedLimits = serverState.use_alt_speed_limits;
            updateAltSpeedIcon(alternativeSpeedLimits);
        }

        serverSyncMainDataInterval = Math.max(serverState.refresh_interval, 500);
    };

    const updateAltSpeedIcon = function(enabled) {
        if (enabled)
            $('alternativeSpeedLimits').src = "images/slow.svg";
        else
            $('alternativeSpeedLimits').src = "images/slow_off.svg";
    };

    $('alternativeSpeedLimits').addEvent('click', function() {
        // Change icon immediately to give some feedback
        updateAltSpeedIcon(!alternativeSpeedLimits);

        new Request({
            url: 'api/v2/transfer/toggleSpeedLimitsMode',
            method: 'post',
            onComplete: function() {
                alternativeSpeedLimits = !alternativeSpeedLimits;
                updateMainData();
            },
            onFailure: function() {
                // Restore icon in case of failure
                updateAltSpeedIcon(alternativeSpeedLimits);
            }
        }).send();
    });

    $('DlInfos').addEvent('click', globalDownloadLimitFN);
    $('UpInfos').addEvent('click', globalUploadLimitFN);

    $('showTopToolbarLink').addEvent('click', function(e) {
        showTopToolbar = !showTopToolbar;
        localStorage.setItem('show_top_toolbar', showTopToolbar.toString());
        if (showTopToolbar) {
            $('showTopToolbarLink').firstChild.style.opacity = '1';
            $('mochaToolbar').removeClass('invisible');
        }
        else {
            $('showTopToolbarLink').firstChild.style.opacity = '0';
            $('mochaToolbar').addClass('invisible');
        }
        MochaUI.Desktop.setDesktopSize();
    });

    $('showStatusBarLink').addEvent('click', function(e) {
        showStatusBar = !showStatusBar;
        localStorage.setItem('show_status_bar', showStatusBar.toString());
        if (showStatusBar) {
            $('showStatusBarLink').firstChild.style.opacity = '1';
            $('desktopFooterWrapper').removeClass('invisible');
        }
        else {
            $('showStatusBarLink').firstChild.style.opacity = '0';
            $('desktopFooterWrapper').addClass('invisible');
        }
        MochaUI.Desktop.setDesktopSize();
    });

    $('registerMagnetHandlerLink').addEvent('click', function(e) {
        registerMagnetHandler();
    });

    $('speedInBrowserTitleBarLink').addEvent('click', function(e) {
        speedInTitle = !speedInTitle;
        localStorage.setItem('speed_in_browser_title_bar', speedInTitle.toString());
        if (speedInTitle)
            $('speedInBrowserTitleBarLink').firstChild.style.opacity = '1';
        else
            $('speedInBrowserTitleBarLink').firstChild.style.opacity = '0';
        processServerState();
    });

    $('showSearchEngineLink').addEvent('click', function(e) {
        showSearchEngine = !showSearchEngine;
        localStorage.setItem('show_search_engine', showSearchEngine.toString());
        if (showSearchEngine) {
            $('showSearchEngineLink').firstChild.style.opacity = '1';
            $('mainWindowTabs').removeClass('invisible');

            addMainWindowTabsEventListener();
            if (!MochaUI.Panels.instances.SearchPanel)
                addSearchPanel();
        }
        else {
            $('showSearchEngineLink').firstChild.style.opacity = '0';
            $('mainWindowTabs').addClass('invisible');
            $("transfersTabLink").click();

            removeMainWindowTabsEventListener();
        }
    });

    $('StatisticsLink').addEvent('click', StatisticsLinkFN);

    // main window tabs

    const showTransfersTab = function() {
        $("filtersColumn").removeClass("invisible");
        $("filtersColumn_handle").removeClass("invisible");
        $("mainColumn").removeClass("invisible");

        customSyncMainDataInterval = null;
        clearTimeout(syncMainDataTimer);
        syncMainDataTimer = syncMainData.delay(100);

        hideSearchTab();
    };

    const hideTransfersTab = function() {
        $("filtersColumn").addClass("invisible");
        $("filtersColumn_handle").addClass("invisible");
        $("mainColumn").addClass("invisible");
        MochaUI.Desktop.resizePanels();
    };

    const showSearchTab = function() {
        if (!searchTabInitialized) {
            initSearchTab();
            searchTabInitialized = true;
        }

        $("searchTabColumn").removeClass("invisible");
        customSyncMainDataInterval = 30000;
        hideTransfersTab();
    };

    const hideSearchTab = function() {
        $("searchTabColumn").addClass("invisible");
        MochaUI.Desktop.resizePanels();
    };

    const addMainWindowTabsEventListener = function() {
        $('transfersTabLink').addEvent('click', showTransfersTab);
        $('searchTabLink').addEvent('click', showSearchTab);
    };

    const removeMainWindowTabsEventListener = function() {
        $('transfersTabLink').removeEvent('click', showTransfersTab);
        $('searchTabLink').removeEvent('click', showSearchTab);
    };

    const addSearchPanel = function() {
        new MochaUI.Panel({
            id: 'SearchPanel',
            title: 'Search',
            header: false,
            padding: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
            },
            loadMethod: 'xhr',
            contentURL: 'search.html',
            content: '',
            column: 'searchTabColumn',
            height: null
        });
    };

    new MochaUI.Panel({
        id: 'transferList',
        title: 'Panel',
        header: false,
        padding: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
        },
        loadMethod: 'xhr',
        contentURL: 'transferlist.html',
        onContentLoaded: function() {
            handleDownloadParam();
            updateMainData();
        },
        column: 'mainColumn',
        onResize: saveColumnSizes,
        height: null
    });
    let prop_h = localStorage.getItem('properties_height_rel');
    if ($defined(prop_h))
        prop_h = prop_h.toFloat() * Window.getSize().y;
    else
        prop_h = Window.getSize().y / 2.0;
    new MochaUI.Panel({
        id: 'propertiesPanel',
        title: 'Panel',
        header: true,
        padding: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
        },
        contentURL: 'properties_content.html',
        require: {
            css: ['css/Tabs.css', 'css/dynamicTable.css'],
            js: ['scripts/prop-general.js', 'scripts/prop-trackers.js', 'scripts/prop-peers.js', 'scripts/prop-webseeds.js', 'scripts/prop-files.js'],
        },
        tabsURL: 'properties.html',
        tabsOnload: function() {
            MochaUI.initializeTabs('propertiesTabs');

            updatePropertiesPanel = function() {
                if (!$('prop_general').hasClass('invisible'))
                    updateTorrentData();
                else if (!$('prop_trackers').hasClass('invisible'))
                    updateTrackersData();
                else if (!$('prop_peers').hasClass('invisible'))
                    updateTorrentPeersData();
                else if (!$('prop_webseeds').hasClass('invisible'))
                    updateWebSeedsData();
                else if (!$('prop_files').hasClass('invisible'))
                    updateTorrentFilesData();
            };

            $('PropGeneralLink').addEvent('click', function(e) {
                $$('.propertiesTabContent').addClass('invisible');
                $('prop_general').removeClass("invisible");
                hideFilesFilter();
                updatePropertiesPanel();
                localStorage.setItem('selected_tab', this.id);
            });

            $('PropTrackersLink').addEvent('click', function(e) {
                $$('.propertiesTabContent').addClass('invisible');
                $('prop_trackers').removeClass("invisible");
                hideFilesFilter();
                updatePropertiesPanel();
                localStorage.setItem('selected_tab', this.id);
            });

            $('PropPeersLink').addEvent('click', function(e) {
                $$('.propertiesTabContent').addClass('invisible');
                $('prop_peers').removeClass("invisible");
                hideFilesFilter();
                updatePropertiesPanel();
                localStorage.setItem('selected_tab', this.id);
            });

            $('PropWebSeedsLink').addEvent('click', function(e) {
                $$('.propertiesTabContent').addClass('invisible');
                $('prop_webseeds').removeClass("invisible");
                hideFilesFilter();
                updatePropertiesPanel();
                localStorage.setItem('selected_tab', this.id);
            });

            $('PropFilesLink').addEvent('click', function(e) {
                $$('.propertiesTabContent').addClass('invisible');
                $('prop_files').removeClass("invisible");
                showFilesFilter();
                updatePropertiesPanel();
                localStorage.setItem('selected_tab', this.id);
            });

            $('propertiesPanel_collapseToggle').addEvent('click', function(e) {
                updatePropertiesPanel();
            });
        },
        column: 'mainColumn',
        height: prop_h
    });

    const showFilesFilter = function() {
        $('torrentFilesFilterToolbar').removeClass("invisible");
    };

    const hideFilesFilter = function() {
        $('torrentFilesFilterToolbar').addClass("invisible");
    };

    let prevTorrentsFilterValue;
    let torrentsFilterInputTimer = null;
    // listen for changes to torrentsFilterInput
    $('torrentsFilterInput').addEvent('input', function() {
        const value = $('torrentsFilterInput').get("value");
        if (value !== prevTorrentsFilterValue) {
            prevTorrentsFilterValue = value;
            clearTimeout(torrentsFilterInputTimer);
            torrentsFilterInputTimer = setTimeout(function() {
                torrentsTable.updateTable(false);
            }, 400);
        }
    });

    if (showSearchEngine) {
        addMainWindowTabsEventListener();
        addSearchPanel();
    }
});

function registerMagnetHandler() {
    if (typeof navigator.registerProtocolHandler !== 'function') {
        alert("Your browser does not support this feature");
        return;
    }

    const hashParams = getHashParamsFromUrl();
    hashParams.download = '';

    const templateHashString = Object.toQueryString(hashParams).replace('download=', 'download=%s');

    const templateUrl = location.origin + location.pathname
        + location.search + '#' + templateHashString;

    navigator.registerProtocolHandler('magnet', templateUrl,
        'qBittorrent WebUI magnet handler');
}

function handleDownloadParam() {
    // Extract torrent URL from download param in WebUI URL hash
    const downloadHash = "#download=";
    if (location.hash.indexOf(downloadHash) !== 0)
        return;

    const url = location.hash.substring(downloadHash.length);
    // Remove the processed hash from the URL
    history.replaceState('', document.title, (location.pathname + location.search));
    showDownloadPage([url]);
}

function getHashParamsFromUrl() {
    const hashString = location.hash ? location.hash.replace(/^#/, '') : '';
    return (hashString.length > 0) ? String.parseQueryString(hashString) : {};
}

function closeWindows() {
    MochaUI.closeAll();
}

function setupCopyEventHandler() {
    if (clipboardEvent)
        clipboardEvent.destroy();

    clipboardEvent = new ClipboardJS('.copyToClipboard', {
        text: function(trigger) {
            switch (trigger.id) {
                case "copyName":
                    return copyNameFN();
                case "copyMagnetLink":
                    return copyMagnetLinkFN();
                case "copyHash":
                    return copyHashFN();
                default:
                    return "";
            }
        }
    });
}

new Keyboard({
    defaultEventType: 'keydown',
    events: {
        'ctrl+a': function(event) {
            torrentsTable.selectAll();
            event.preventDefault();
        },
        'delete': function(event) {
            deleteFN();
            event.preventDefault();
        }
    }
}).activate();
