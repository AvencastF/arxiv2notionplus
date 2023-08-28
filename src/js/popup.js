import $ from 'jquery';

window.jQuery = $;
window.$ = $;

import 'fomantic-ui/dist/semantic.css';
import 'fomantic-ui-css/semantic.css';
import 'fomantic-ui/dist/semantic.min.js';
import Mustache from "mustache";
import NotionClient from "./notion.js";

const TEST_URL = "https://arxiv.org/abs/2112.10703"; // "https://arxiv.org/abs/1810.00826";
const ARXIV_API = "http://export.arxiv.org/api/query/search_query";

class UI {
    constructor() {
        this.setupSaveButton();
        this.client = new NotionClient();
        this.connectionTest().then(r => {
            this.getCurrentTabUrl();

            $("#js-form").removeClass("loading")
        });
        // this.getPaperInfo(TEST_URL);
        this.selectedTags = []
        this.selectedPage = ""
    }

    getCurrentTabUrl() {
        console.log('getCurrentTabUrl')

        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            const url = tabs[0].url;
            this.data = this.getPaperInfo(url);
        });

        // document.addEventListener("DOMContentLoaded", () => {
        //
        // });
    }

    async connectionTest() {
        try {
            const d = await chrome.storage.local.get("botId");

            if (!this.client.token && d.botId) {
                const botId = d.botId;
                const data = await this.client.requestToken(botId);

                if (data.name === "UnauthorizedError") {
                    this.renderMessage("danger", "You are not logged in notion.so.");
                } else {
                    this.client.token = data.token;
                }
            }

            await this.client.retrieveDatabase().then((data) => {
                data.results[0].properties.Tag.multi_select.options.forEach((tag) => {
                    console.log("tag: ", tag)

                    // <div class="item" data-value="angular">Angular</div>
                    const template = `<div class="item" data-value=${tag.name}> {{tag.name}} </div>`;
                    const rendered = Mustache.render(template, {text: tag});

                    const existingElement = document.querySelector(`#js-tag-database.item[data-text="${tag.name}"]`);

                    if (!existingElement) {
                        document
                            .getElementById("js-tag-database")
                            .insertAdjacentHTML("beforeend", rendered);
                    }

                    const optionValue = tag.name; // The data value of the option you want to add
                    const optionColor = tag.color; // The text content of the option

                    const existingOption = document.querySelector(`#js-tag-database .menu .item[data-value="${optionValue}"]`);

                    if (!existingOption) {
                        const option = `<div class="item" data-value=${optionValue}><div class="ui ${optionColor} empty circular label"></div>${optionValue}</div>`;
                        document
                            .getElementById("js-tag-database").querySelector(".menu")
                            .insertAdjacentHTML("beforeend", option);
                    }
                });
            });

        } catch (error) {
            console.error("Error in connectionTest:", error);
        }
    }


    setupSaveButton() {

        console.log("setupSaveButton")
        console.log(document.getElementById("js-save"))

        const ui = this

        document.getElementById("js-save").addEventListener("click", async () => {

            const button = document.getElementById("js-save");
            const client = this.client
            const _data = this.data

            button.classList.add("onclic");

            // Create the page
            await createAndHandlePage();

            async function createAndHandlePage() {
                try {
                    const data = await client.createPage(_data, ui.selectedTags, ui.selectedPage);

                    // Now, depending on the result, decide on the next step
                    if (data.status && data.status === 400) {
                        handleError(`[${data.code}] ${data.message}`);
                    } else {
                        handleSuccess();
                    }
                } catch (error) {
                    console.error("Error during page creation:", error);
                    handleError("Unexpected error during page creation.");
                }
            }

            function handleSuccess() {
                button.classList.remove("onclic");
                // button.style.backgroundColor = "green";
                button.textContent = "Done";
                // setTimeout(() => window.close(), 2000);
            }

            function handleError(message) {
                button.classList.remove("onclic");
                // button.style.backgroundColor = "red";
                button.textContent = message;
                // If you want the error message to disappear after some time or revert the button to its original state
                // you can set another timeout here
            }

        });
    }


    isArxivUrl(url) {
        return url && url.indexOf("https://arxiv.org") === 0;
    }

    isPDF(url) {
        return url && url.split(".").pop() === "pdf";
    }

    async getPaperInfo(url) {
        if (this.isArxivUrl(url)) return this.getArXivInfo(url);
        //     if (this.isPDF(url)) return this.getPDFInfo(url); // TODO
    }

    parseArXivId(str) {
        return str.match(/\d+.\d+/);
    }


    // setFormContents(paperTitle, abst, published, comment, authors, updated, subjects);
    setFormContents(paperTitle, abst, published, comment, authors, updated, subjects) {
        document.getElementById("js-title").value = paperTitle;
        document.getElementById("js-abst").value = abst;
        document.getElementById("js-published").value = published;
        document.getElementById("js-updated").value = updated;

        // document.getElementById("js-comment").value = comment;

        function AddBullets(raw_lists, js_container) {
            raw_lists.forEach((l) => {
                console.log(l);
                const template = `<i class="item">{{ text }}</i>`;
                const rendered = Mustache.render(template, {text: l});

                const existingElement = document.querySelector(`#${js_container}.item[data-text="${l}"]`);

                if (!existingElement) {
                    document
                        .getElementById(js_container)
                        .insertAdjacentHTML("beforeend", rendered);
                }
            });

        }

        AddBullets(subjects, "js-subject-container")
        AddBullets(authors, "js-author-container")


    }

    async getArXivInfo(url) {
        const paperId = this.parseArXivId(url);

        const res = await fetch(ARXIV_API + "?id_list=" + paperId.toString());
        if (res.status !== 200) {
            console.log("[ERR] arXiv API request failed");
            return;
        }
        const data = await res.text(); // TODO: error handling
        console.log(res.status);
        const xmlData = new window.DOMParser().parseFromString(data, "text/xml");
        console.log(xmlData);

        const entry = xmlData.querySelector("entry");
        const paperTitle = entry.querySelector("title").textContent;
        const abst = entry.querySelector("summary").textContent;
        const authors = Array.from(entry.querySelectorAll("author")).map((author) => {
            return author.textContent.trim();
        });
        const published = entry.querySelector("published").textContent;

        // Extracting the updated date
        const updated = entry.querySelector("updated").textContent;

        // Extracting subjects/keywords (categories)
        const subjects = Array.from(entry.querySelectorAll("category")).map((category) => {
            return category.getAttribute("term");
        });

        const comment_query = entry.querySelector("comment");
        let comment = "";
        if (comment_query == null) {
            console.log("Empty comment in arXiv page");
            comment = "N/A"
        } else {
            comment = comment_query.textContent;
        }

        // Extracting PDF link
        // Extracting the PDF link
        const linkElement = entry.querySelector('link[title="pdf"]');
        const pdf_link = linkElement ? linkElement.getAttribute('href') : null;

        this.setFormContents(paperTitle, abst, published, comment, authors, updated, subjects);
        return {
            title: paperTitle,
            abst: abst,
            authors: authors,
            url: url,
            published: published,
            updated: updated,
            subjects: subjects,
            comment: comment,
            pdf: pdf_link,
        };
    }

    UpdateTags(tags) {
        this.selectedTags = tags

        console.log("Updated Tags", tags, this.selectedTags)
    }

    UpdatePage(page) {
        this.selectedPage = page

        console.log("Updated Tags", page, this.selectedPage)
    }
}

$('.ui.dropdown')
    .dropdown();

$(document).ready(function () {
    console.log('hi', window.location.href);
    const ui = new UI();


    $('.ui.dropdown.added').dropdown({
        allowAdditions: true,
        hideAdditions: false,
        clearable: true,
        className: {
            addition: 'addition'
        },
    }).on('change', function () {
        const selected = $('.ui.dropdown.added').dropdown('get values')
        ui.UpdateTags(selected)
    });

    $('#js-select-database').on('change', function () {
        const selected = $('#js-select-database').dropdown('get value')
        ui.UpdatePage(selected)
    }).popup({
        title: 'Notion Page',
        content: 'Select page in workspace @ Notion',
        delay: {
            show: 500,
            hide: 250,
        }
    });

    // $('.clearable .ui.selection.dropdown')
    //     .dropdown({
    //         clearable: true
    //     });

    $('#title_field').popup({
        title: 'Paper Title',
        content: 'read-only, auto-generated',
        delay: {
            show: 500,
            hide: 250,
        }
    });

    $('#abstract_field').popup({
        title: 'Paper Abstract',
        content: 'read-only, auto-generated',
        delay: {
            show: 500,
            hide: 250,
        }
    });

    $('#published_field').popup({
        title: 'Paper Published Date',
        content: 'read-only, auto-generated',
        delay: {
            show: 500,
            hide: 250,
        }
    });

    $('#updated_field').popup({
        title: 'Paper Updated Date',
        content: 'read-only, auto-generated',
        delay: {
            show: 500,
            hide: 250,
        }
    });

    $('#js-tag-database').popup({
        title: 'Tags for this paper',
        content: 'Select existed tags in notion, or add new one',
        delay: {
            show: 500,
            hide: 250,
        }
    });

});




