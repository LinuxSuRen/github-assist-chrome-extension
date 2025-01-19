function humanReadableNumber(number) {
    if (number < 1000) return number;
    const units = ["K", "M", "B", "T"];
    let unitIndex = -1;
    do {
        number /= 1000;
        unitIndex++;
    } while (number >= 1000 && unitIndex < units.length - 1);
    return number.toFixed(1) + units[unitIndex];
}

function getHotLevelColor(downloads) {
    if (downloads < 1000) return 'green';
    if (downloads < 10000) return 'orange';
    if (downloads < 100000) return 'red';
    return '';
}

async function fetchWithRetry(url, options = {}, retries = 6) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.status === 406 || response.status === 302) {
                throw new Error('Need to login');
            }
            if (!response.ok) throw new Error('Network response was not ok');
            return response;
        } catch (error) {
            if (error.message === 'Need to login') {
                throw error;
            }
            if (i === retries - 1) throw error;
        }
    }
}

async function fetchTotalDownloads(repoOwner, repoName) {
    const releases = await fetchReleaseDownloads(repoOwner, repoName);
    const totalDownloads = releases.reduce((acc, release) => {
        return acc + release.assets.reduce((assetAcc, asset) => assetAcc + asset.download_count, 0);
    }, 0);
    return totalDownloads;
}

async function fetchReleaseDownloads(repoOwner, repoName) {
    const cacheKey = `github_release_downloads_${repoOwner}_${repoName}`;
    const cacheExpiryKey = `github_release_downloads_expiry_${repoOwner}_${repoName}`;
    const cacheExpiryTime = 10 * 60 * 1000; // 10 minutes in milliseconds

    const cachedData = await new Promise((resolve, reject) => {
        chrome.storage.local.get([cacheKey, cacheExpiryKey], result => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(result);
            }
        });
    });

    const now = Date.now();

    if (cachedData[cacheKey] && cachedData[cacheExpiryKey] && now < cachedData[cacheExpiryKey]) {
        return JSON.parse(cachedData[cacheKey]);
    }

    const response = await fetchWithRetry(`https://api.github.com/repos/${repoOwner}/${repoName}/releases`);
    const releases = await response.json();

    await new Promise((resolve, reject) => {
        chrome.storage.local.set({
            [cacheKey]: JSON.stringify(releases),
            [cacheExpiryKey]: now + cacheExpiryTime
        }, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });

    return releases;
}

async function fetchTrafficData(repoOwner, repoName) {
    const url = `https://github.com/${repoOwner}/${repoName}/graphs/traffic-data`;
    const options = {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };
    const response = await fetchWithRetry(url, options);
    if (!response.ok) {
        throw new Error('Failed to fetch traffic data');
    }
    return response.json();
}

function waitForElement(selector, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const interval = 100;
        let elapsedTime = 0;

        const checkExist = setInterval(() => {
            const element = document.querySelector(selector);
            if (element) {
                clearInterval(checkExist);
                resolve(element);
            } else if (elapsedTime >= timeout) {
                clearInterval(checkExist);
                reject(new Error(`Element with selector "${selector}" not found within ${timeout}ms`));
            }
            elapsedTime += interval;
        }, interval);
    });
}

function renderChart(releases) {
    releases.sort((a, b) => a.tag_name.localeCompare(b.tag_name, undefined, { numeric: true, sensitivity: 'base' }));
    const labels = releases.map(release => release.tag_name);
    const data = releases.map(release => release.assets.reduce((acc, asset) => acc + asset.download_count, 0));

    const canvas = document.createElement('canvas');
    canvas.id = 'downloadsChart';
    canvas.style.width = '100%';
    canvas.style.height = '400px';

    const container = waitForElement("#release_page_title");
    container.then(ele => {
        if (ele) {
            ele.after(canvas);
        }
    });

    new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Downloads',
                data: data,
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                fill: true,
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Version'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Downloads'
                    }
                }
            }
        }
    });
}

function renderTrafficChart(data) {
    data.counts.sort((a, b) => a.bucket - b.bucket);
    const labels = data.counts.map(item => {
        const date = new Date(item.bucket * 1000);
        return date.getMonth() + 1 + '/' + date.getDate();
    });
    const views = data.counts.map(item => item.total);
    const uniqueViews = data.counts.map(item => item.unique);

    const canvas = document.createElement('canvas');
    canvas.hidden = true;

    const nav = waitForElement('nav[aria-label="Repository files"] > ul')
    nav.then(ele => {
        const trafficChart = document.createElement('li');
        trafficChart.innerHTML = `<a class="UnderlineTabbedInterface__StyledUnderlineItem-sc-4ilrg0-2 beOdPj">Traffic</a>`;
        trafficChart.onclick = () => {
            const zone = document.querySelector('div.js-snippet-clipboard-copy-unpositioned');
            zone.replaceChildren(canvas);
            canvas.hidden = false;
            ele.querySelector('a[aria-current=page]').removeAttribute('aria-current');
            trafficChart.querySelector('a').setAttribute('aria-current', 'page');
        };
        ele.appendChild(trafficChart);
        ele.onclick = () => {
            const eles = ele.querySelectorAll('a[aria-current=page]')
            if (eles.length > 1) {
                trafficChart.querySelector('a').removeAttribute('aria-current');
            }
        }
    });

    new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Total',
                    data: views,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    fill: true,
                },
                {
                    label: 'Unique',
                    data: uniqueViews,
                    borderColor: 'rgba(153, 102, 255, 1)',
                    backgroundColor: 'rgba(153, 102, 255, 0.2)',
                    fill: true,
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Count'
                    }
                }
            }
        }
    });
}

function updateDownloads() {
    const pathParts = window.location.pathname.split('/');
    const repoOwner = pathParts[1];
    const repoName = pathParts[2];
    const isRepoHomePage = pathParts.length === 3;
    const isRepoReleasesPage = pathParts.length === 4 && pathParts[3] === 'releases';
    const isRepoSingleReleasesPage = pathParts.length === 6 && pathParts[3] === 'releases' && pathParts[4] === 'tag';

    if (isRepoHomePage) {
        const releasesSummaryZone = waitForElement("#repo-content-pjax-container > div > div > div > div.Layout-sidebar > div > div:nth-child(2) > div > a");
        releasesSummaryZone.then(ele => {
            if (ele) {
                fetchTotalDownloads(repoOwner, repoName).then(totalDownloads => {
                    const downloads = document.createElement('div');
                    downloads.innerText = `${humanReadableNumber(totalDownloads)} downloads`;
                    downloads.title = `${totalDownloads} downloads`;
                    downloads.style.color = getHotLevelColor(totalDownloads);

                    ele.append(downloads);
                }).catch(error => {
                    console.error('Failed to fetch total downloads:', error);
                });
            }
        });

        fetchTrafficData(repoOwner, repoName).then(data => {
            renderTrafficChart(data);
        }).catch(error => {
            console.error('Failed to fetch traffic data:', error);
        });
    } else if (isRepoReleasesPage) {
        fetchReleaseDownloads(repoOwner, repoName).then(releases => {
            renderChart(releases);
        }).catch(error => {
            console.error('Failed to fetch release downloads:', error);
        });
    } else if (isRepoSingleReleasesPage) {
        fetchReleaseDownloads(repoOwner, repoName).then(releases => {
            releases.forEach(release => {
                if (release.tag_name !== pathParts[5]) return;

                release.assets.forEach(asset => {
                    const assetElement = waitForElement(`a[href$="${asset.name}"]`);
                    assetElement.then(ele => {
                        if (ele && ele.parentNode) {
                            const downloads = document.createElement('span');
                            downloads.innerText = ` (${humanReadableNumber(asset.download_count)} downloads)`;
                            downloads.title = `${asset.download_count} downloads`;
                            downloads.style.color = getHotLevelColor(asset.download_count);

                            const mirrorLink = document.createElement('a');
                            mirrorLink.href = `https://files.m.daocloud.io/github.com/${ele.getAttribute('href')}`;
                            mirrorLink.innerText = 'DaoCloud';
                            mirrorLink.style.marginLeft = '10px';
                            mirrorLink.style.color = 'blue';

                            ele.parentNode.append(downloads);
                            ele.parentNode.append(mirrorLink);
                        }
                    })
                });
            });
        }).catch(error => {
            console.error('Failed to fetch release downloads:', error);
        });
    }
}

const originalPushState = history.pushState;
history.pushState = function() {
    originalPushState.apply(this, arguments);
    updateDownloads();
};

const originalReplaceState = history.replaceState;
history.replaceState = function() {
    originalReplaceState.apply(this, arguments);
    updateDownloads();
};

window.addEventListener('popstate', updateDownloads);

const observer = new MutationObserver(() => {
    const currentPath = window.location.pathname;
    if (currentPath !== observer.lastPath) {
        observer.lastPath = currentPath;
        updateDownloads();
    }
});

observer.observe(document, { subtree: true, childList: true });
observer.lastPath = window.location.pathname;

updateDownloads();
