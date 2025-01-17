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
            if (!response.ok) throw new Error('Network response was not ok');
            return response;
        } catch (error) {
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

async function fetchStarHistory(repoOwner, repoName) {
    let page = 1;
    const stargazers = [];

    while (true) {
        const response = await fetchWithRetry(`https://api.github.com/repos/${repoOwner}/${repoName}/stargazers?page=${page}&per_page=100`, {
            headers: {
                Accept: 'application/vnd.github.v3.star+json'
            }
        });
        const data = await response.json();
        if (data.length === 0) break;
        stargazers.push(...data);
        page++;
    }

    const starHistory = {};
    stargazers.forEach(stargazer => {
        const date = new Date(stargazer.starred_at).toLocaleDateString();
        if (!starHistory[date]) {
            starHistory[date] = 0;
        }
        starHistory[date]++;
    });

    const labels = Object.keys(starHistory).sort((a, b) => new Date(a) - new Date(b));
    const dailyData = labels.map(label => starHistory[label]);
    const cumulativeData = [];
    let cumulativeValue = 0;
    labels.forEach((label, index) => {
        cumulativeValue += dailyData[index];
        cumulativeData.push(cumulativeValue);
    });

    return { labels, dailyData, cumulativeData };
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

function renderStarChart(starHistory, showCumulative = true) {
    const { labels, dailyData, cumulativeData } = starHistory;
    const data = showCumulative ? cumulativeData : dailyData;

    const canvas = document.createElement('canvas');
    canvas.id = 'starChart';
    canvas.style.width = '100%';
    canvas.style.height = '400px';

    const container = waitForElement("#repo-content-pjax-container > div > div > div > div.Layout-main");
    container.then(ele => {
        if (ele) {
            ele.prepend(canvas);
        }
    });

    new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: showCumulative ? 'Cumulative Stars' : 'Daily Stars',
                data: data,
                borderColor: 'rgba(255, 99, 132, 1)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                fill: true,
            }]
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
                        text: 'Stars'
                    }
                }
            }
        }
    });

    const toggleButton = document.createElement('button');
    toggleButton.innerText = showCumulative ? 'Show Daily Stars' : 'Show Cumulative Stars';
    toggleButton.style.marginTop = '10px';
    toggleButton.onclick = () => {
        canvas.remove();
        toggleButton.remove();
        renderStarChart(starHistory, !showCumulative);
    };

    container.then(ele => {
        if (ele) {
            ele.prepend(toggleButton);
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

        fetchStarHistory(repoOwner, repoName).then(starHistory => {
            renderStarChart(starHistory);
        }).catch(error => {
            console.error('Failed to fetch star history:', error);
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
