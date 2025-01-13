// https://api.github.com/repos/linuxsuren/api-testing/releases

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

async function fetchWithRetry(url, options = {}, retries = 3) {
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
    const cacheKey = `github_total_downloads_${repoOwner}_${repoName}`;
    const cacheExpiryKey = `github_total_downloads_expiry_${repoOwner}_${repoName}`;
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
    const totalDownloads = releases.reduce((acc, release) => {
        return acc + release.assets.reduce((assetAcc, asset) => assetAcc + asset.download_count, 0);
    }, 0);

    await new Promise((resolve, reject) => {
        chrome.storage.local.set({
            [cacheKey]: JSON.stringify(totalDownloads),
            [cacheExpiryKey]: now + cacheExpiryTime
        }, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });

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

function updateDownloads() {
    const pathParts = window.location.pathname.split('/');
    const repoOwner = pathParts[1];
    const repoName = pathParts[2];
    const isRepoHomePage = pathParts.length === 3;
    const isRepoSingleReleasesPage = pathParts.length === 6 && pathParts[3] === 'releases' && pathParts[4] === 'tag';

    if (isRepoHomePage) {
        var releasesSummaryZone = document.querySelector("#repo-content-pjax-container > div > div > div > div.Layout-sidebar > div > div:nth-child(2) > div > a");

        if (releasesSummaryZone) {
            fetchTotalDownloads(repoOwner, repoName).then(totalDownloads => {
                const downloads = document.createElement('div');
                downloads.innerText = `${humanReadableNumber(totalDownloads)} downloads`;
                downloads.title = `${totalDownloads} downloads`;
                downloads.style.color = getHotLevelColor(totalDownloads);

                releasesSummaryZone.append(downloads);
            }).catch(error => {
                console.error('Failed to fetch total downloads:', error);
            });
        }
    } else if (isRepoSingleReleasesPage) {
        fetchReleaseDownloads(repoOwner, repoName).then(releases => {
            releases.forEach(release => {
                if (release.tag_name !== pathParts[5]) return;

                release.assets.forEach(asset => {
                    const assetElement = document.querySelector(`a[href$="${asset.name}"]`);
                    if (assetElement) {
                        const downloads = document.createElement('span');
                        downloads.innerText = ` (${humanReadableNumber(asset.download_count)} downloads)`;
                        downloads.title = `${asset.download_count} downloads`;
                        downloads.style.color = getHotLevelColor(asset.download_count);
                        assetElement.parentNode.append(downloads);
                    }
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
updateDownloads();
