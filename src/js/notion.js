import $ from 'jquery';

window.jQuery = $;
window.$ = $;


export default class Notion {
    constructor() {
        this.token = null;
        this.apiBase = "https://api.notion.com/v1/";
    }

    torkenizedHeaders() {
        return {
            "Content-Type": "application/json", "Notion-Version": "2021-05-13", Authorization: `Bearer ${this.token}`,
        };
    }

    async requestToken(botId) {
        const url = "https://www.notion.so/api/v3/getBotToken";
        const body = {botId: botId};
        const headers = {
            Accept: "application/json, */*", "Content-type": "application/json",
        };
        const res = await fetch(url, {
            method: "POST", mode: "cors", headers: headers, credentials: "include", body: JSON.stringify(body),
        });
        return await res.json();
    }

    async retrievePage(pageId) {
        try {
            const url = this.apiBase + `pages/${pageId}`;
            const res = await fetch(url, {
                method: "GET", mode: "cors", headers: this.torkenizedHeaders(),
            });
            const data = await res.json();
            console.log(data);
        } catch (err) {
            throw err;
        }
    }

    async createPage(_data, selectedTags, selectedPage) {
        const data = await _data;
        console.log('data: ', data)
        const databaseId = selectedPage;
        console.log(selectedPage)
        const title = data.title;
        const abst = data.abst;
        const paperUrl = data.url;
        const published = data.published;
        const updated = data.updated;
        const comment = data.comment;
        const authorsFormatted = data.authors.join(", ");
        const authors = authorsFormatted.split(', ');
        const subjectsFormatted = data.subjects.join(", ");
        const subjects = subjectsFormatted.split(', ');
        const tags = selectedTags
        const pdf = data.pdf;

        const {Client} = require('@notionhq/client');
        const notion = new Client({auth: this.token});


        console.log(subjects, authors, tags)
        function make_multi_select(lists) {
            let out_list = [];
            lists.forEach(function (v) {
                let obj = {};
                obj["name"] = v;
                out_list.push(obj);
            });
            return out_list;
        }

        const subject_multi_select = make_multi_select(subjects)
        const author_multi_select = make_multi_select(authors)
        const tags_multi_select = make_multi_select(tags)

        try {
            const url = this.apiBase + "pages";
            const parent = {
                type: "database_id", database_id: databaseId,
            };

            const properties = {
                Title: {
                    id: "title", type: "title", title: [{text: {content: title}}],
                }, Subjects: {
                    id: "subjects", type: "multi_select", multi_select: subject_multi_select,
                }, Publisher: {
                    id: "conference", type: "select", select: {name: "arXiv"},
                }, URL: {
                    id: "url", type: "url", url: paperUrl,
                }, Abstract: {
                    id: "abstract", type: "rich_text", rich_text: [{
                        type: "text", text: {content: abst, link: null}, annotations: {
                            bold: false,
                            italic: true,
                            strikethrough: false,
                            underline: false,
                            code: false,
                            color: "default",
                        }, plain_text: abst, href: null,
                    },],
                }, Authors: {
                    id: "authors", type: "multi_select", multi_select: author_multi_select,
                }, Published: {
                    id: "published", type: "date", date: {start: published, end: null},
                }, Comment: {
                    id: "comment", type: "url", url: comment,
                }, Updated: {
                    id: "updated", type: "date", date: {start: updated, end: null},
                }, Tag: {
                    id: "tag", type: "multi_select", multi_select: tags_multi_select,
                },
            };

            const data = await notion.pages.create({
                "parent": parent, "properties": properties,
            });

            console.log(data);
            return data;
        } catch (err) {
            throw err;
        }
    }

    async retrieveDatabase() {
        try {
            const url = this.apiBase + "databases";
            const headers = this.torkenizedHeaders();
            console.log(headers);
            const res = await fetch(url, {
                method: "GET", mode: "cors", headers: headers,
            });
            const data = await res.json();

            data.results.forEach((result) => {
                const optionValue = result.id; // The data value of the option you want to add
                const optionText = result.title[0].text.content; // The text content of the option

                const existingOption = document.querySelector(`#js-select-database .menu .item[data-value="${optionValue}"]`);
                const defaultTextElement = document.querySelector('#js-select-database').querySelector(".default.text");

                if (!existingOption) {
                    const option = `<div class="item" data-value="${optionValue}">${optionText}</div>`;
                    document
                        .getElementById("js-select-database").querySelector(".menu")
                        .insertAdjacentHTML("beforeend", option);

                    // defaultTextElement.textContent = optionText;
                    // defaultTextElement.classList.remove("default");

                    $('#js-select-database').dropdown('refresh').dropdown('set selected', optionValue, false);
                } else {
                    console.log("Option already exists.");
                }
            });
            console.log('retrieveDatabase: ', data);
            return data;
        } catch (err) {
            console.log("[ERR] " + err);
            throw err;
        }
    }
}
