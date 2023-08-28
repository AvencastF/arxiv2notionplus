import "../scss/theme.scss";
import UIKit from "uikit";
import Icons from "uikit/dist/js/uikit-icons";
import Mustache from "mustache";
import NotionClient from "./notion.js";
import thenChrome from "then-chrome";

UIKit.use(Icons);

const TEST_URL = "https://arxiv.org/abs/2112.10703"; // "https://arxiv.org/abs/1810.00826";
const ARXIV_API = "http://export.arxiv.org/api/query/search_query";

class UI {
    constructor() {
        this.setupSaveButton();
        this.client = new NotionClient();
        this.connectionTest();
        this.getCurrentTabUrl();
        this.getPaperInfo(TEST_URL);
    }

    getCurrentTabUrl() {
        document.addEventListener("DOMContentLoaded", () => {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                const url = tabs[0].url;
                this.data = this.getPaperInfo(url);
            });
        });
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

            await this.client.retrieveDatabase();
        } catch (error) {
            console.error("Error in connectionTest:", error);
        }
    }


    setupSaveButton() {

        function addClassWithTimeout(element, className, timeout, callback) {
            element.classList.add(className);
            setTimeout(function () {
                callback(element, className);
            }, timeout);
        }

        document.getElementById("js-save").addEventListener("click", async () => {

            const button = document.getElementById("js-save");
            const client = this.client
            const _data = this.data

            button.classList.add("onclic");

            // Create the page
            await createAndHandlePage();

            async function createAndHandlePage() {
                try {
                    const data = await client.createPage(_data);

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
        document.getElementById("js-comment").value = comment;
        subjects.forEach((sub) => {
            console.log(sub);
            const template = `<span class="uk-badge uk-margin-small-right uk-margin-small-top">{{ text }}</span>`;
            const rendered = Mustache.render(template, {text: sub});
            document
                .getElementById("js-subject-container")
                .insertAdjacentHTML("beforeend", rendered);
        });
        authors.forEach((author) => {
            console.log(author);
            const template = `<span class="uk-badge uk-margin-small-right uk-margin-small-top">{{ text }}</span>`;
            const rendered = Mustache.render(template, {text: author});
            document
                .getElementById("js-chip-container")
                .insertAdjacentHTML("beforeend", rendered);
        });
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
            pdf: pdf_link
        };
    }


    renderMessage(type, message, overwrite = false) {
        // type: warning, danger, success, primary
        const template = `<div class="uk-alert-{{type}}" uk-alert><a class="uk-alert-close" uk-close></a><p>{{message}}</p></div>`;
        const rendered = Mustache.render(template, {
            type: type, message: message,
        });
        if (overwrite) {
            document.getElementById("js-message-container").innerHTML = rendered;
        } else {
            document
                .getElementById("js-message-container")
                .insertAdjacentHTML("beforeend", rendered);
        }
    }
}

const ui = new UI();
