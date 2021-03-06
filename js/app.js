const APP = {
    sw: null,
    imageUrl: null,
    isOnline: 'onLine' in navigator && navigator.onLine,
    configData: null,
    init: () => {
        APP.getConfig();
        APP.registerSW();
        APP.addListeners();
        IDB.initDB(APP.checkPage);
    },
    getConfig: () => {
        const url = `https://api.themoviedb.org/3/configuration?api_key=f8950444a4c0c67cbff1553083941ae3`
        fetch(url) 
            .then(response => {
            if (response.ok) {
                return response.json() 
            } else {
            throw new Error(`something went wrong : ${response.status}`)
            }
        })
        .then(data => {
            APP.imageUrl = data.images.secure_base_url
            console.log(APP.imageUrl)
            APP.configData = data.images
        })
        .catch(error => 
            alert(`Theres been an ERROR!!!!!!!! ${error.name}, ${error.message}`)
            )
    },
    addListeners: () => {
        document.querySelector('.searchBtn').addEventListener('click', SEARCH.handleSearch)
        window.addEventListener('popstate', APP.checkPage)
        navigator.serviceWorker.addEventListener('message', APP.gotMessage);
        //online listeners
        window.addEventListener('online', APP.changeStatus);
        window.addEventListener('offline', APP.changeStatus);
    },
    changeStatus: (ev) => {
    APP.isOnline = ev.type === 'online' ? true : false;
    navigator.serviceWorker.ready.then(registration => {
        registration.active.postMessage({ONLINE: APP.isOnline});
        })
    },
    registerSW: () => {
    navigator.serviceWorker.register('./sw.js').catch(function (err) {
        console.warn(err);
    });
    navigator.serviceWorker.ready.then((registration) => {
        APP.sw = registration.active;
        console.log('sw is registered')
        });
    },
    checkPage: () => {
        let tx = IDB.DB.transaction('searchStore', 'readwrite');
        let searchStore = tx.objectStore('searchStore');
        console.log('checkPage running')
        let url = new URL(location.href)
        let params = url.searchParams
        switch (document.body.id) {
            case 'home':
                let getKeys = searchStore.getAllKeys()
                getKeys.onsuccess = (ev) => {
                    ev.target.result.forEach (key => {
                        let li = document.createElement('li')
                        li.innerHTML = `<p>${key}</p>`
                        document.getElementById('search-history').append(li)
                    })
                }
                break;
            case 'result':
                let keyword = params.get('key')
                IDB.getDBResults('searchStore', keyword)
                break;
            case 'suggestions':
                let id = params.get('id')
                IDB.getDBResults('similarStore', parseInt(id))
                break;
            case 'error':
                let getKeys2 = searchStore.getAllKeys()
                getKeys2.onsuccess = (ev) => {
                    ev.target.result.forEach (key => {
                        console.log('appending')
                        let li = document.createElement('li')
                        li.innerHTML = `<p>${key}</p>`
                        document.getElementById('search-history').append(li)
                    })
                }
                break;
        }
    },
}
const SEARCH = {
    baseUrl : 'https://api.themoviedb.org/3/',
    api: 'f8950444a4c0c67cbff1553083941ae3',
    movieList: [],
    input: null,
    movieId: null,
    movieName: null,
    fetch : (url, type) => {
        if (navigator.onLine) {
            fetch(url)
                .then(response => {
                    console.log(navigator)
                    console.log('fetch complete')
                    console.log(navigator.onLine)
                    if (!response.ok) throw new Error(`Fetch failed ${response.status}`)
                    return response.json()
            })
                .then(data => {
                        SEARCH.movieList = data.results
                        IDB.addResultsToDB(data.results, type);
                    })
                .then (data => {
                    if (type === 'searchStore') {
                        location.href = `${location.origin}/result.html?key=${SEARCH.input}`
                    }
                    if (type === 'similarStore') {
                        console.log(SEARCH.movieName)
                        let currentLocation = location.href
                        location.href = `${location.origin}/suggestions.html?id=${SEARCH.movieId}&name=${SEARCH.movieName}`
                    }
                })
                .catch(err => {
                    console.log('fetch failed')
                    console.warn(err.message)
                })
                } else {
                    location.href = `${location.origin}/404.html`
                    }
    },
    handleSearch: (ev) => {
        ev.preventDefault()
        //check what button is clicked
            if (ev.currentTarget.id === 'get-result') {
                let searchInput = document.querySelector('input').value
                SEARCH.input = searchInput;
                IDB.checkDb('searchStore', searchInput)
            }
                else {
                let id = parseInt(ev.currentTarget.id)
                SEARCH.movieName = ev.currentTarget.querySelector('.card-title').textContent
                SEARCH.movieId = id
                IDB.checkDb('similarStore', id)
            }
    },
}

const IDB = {
    DB: null,
    initDB: (cb) => {
        let version = 1
        let dbOpenRequest = indexedDB.open('SuggestAMovieDB', version);
            dbOpenRequest.onupgradeneeded = function (ev) {
            IDB.DB = ev.target.result; 
            try {
                IDB.DB.deleteObjectStore('similarStore');
                IDB.DB.deleteObjectStore('searchStore');
            } catch (err) {
                console.log('error deleting old DB');
            }
            IDB.DB.createObjectStore('searchStore');
            IDB.DB.createObjectStore('similarStore');
        }
            dbOpenRequest.onerror = function (err) {
            console.warn(err.message)
        }
            dbOpenRequest.onsuccess = function (ev) {
            IDB.DB = dbOpenRequest.result
            console.log(IDB.DB.name, `ready to be used.`);
            cb()
        }
    },
    createTransaction: (storeName)=>{
        let tx = IDB.DB.transaction(storeName, 'readwrite');        //create a transaction to use for some interaction with the database
        return tx;
    },
    addResultsToDB: (obj, storeName)=>{
        let tx = IDB.DB.transaction(storeName, 'readwrite');
        let searchStore = tx.objectStore(storeName);
        if (storeName === 'searchStore' ){
        let formatData = {
            keyword: SEARCH.input.toLowerCase(),
            results: obj
        };
            let addRequest = searchStore.add(formatData, SEARCH.input.toLowerCase()); 
            addRequest.onsuccess = () => {
            }
        }
        else {
            let formatData = {
                movieid: SEARCH.movieId,
                name: SEARCH.movieName,
                results: obj
            };
            let addRequest = searchStore.add(formatData, SEARCH.movieId); 
            addRequest.onsuccess = () => {
            }
        }
    },
    checkDb: (storeName, keyValue) => {
        console.log('checkDB running')
        let getFromStore = IDB.createTransaction(storeName).objectStore(storeName)
        if (typeof keyValue != 'number') keyValue = keyValue.toLowerCase()
        let getRequest = getFromStore.get(keyValue);
        getRequest.onsuccess = (ev) => {
            if (ev.target.result != undefined) {
                console.log(ev.target.result)
                if (SEARCH.input != null) {
                    if (storeName === 'searchStore') {
                        location.href = `${location.origin}/result.html?key=${SEARCH.input}`
                    }
                }
                    if (storeName === 'similarStore') {
                        console.log(ev.target.result)
                        location.href = `${location.origin}/suggestions.html#${keyValue}`
                        location.href = `${location.origin}/suggestions.html?id=${keyValue}&name=${SEARCH.movieName}`
                    }
                } else {
                    //fetch the url
                    if (typeof keyValue === 'string') {
                        let url = `${SEARCH.baseUrl}search/movie?api_key=${SEARCH.api}&query=${keyValue}`;
                        SEARCH.fetch(url, storeName)
                    } 
                    if (typeof keyValue === 'number') {
                        let url = `${SEARCH.baseUrl}movie/${keyValue};/similar?api_key=${SEARCH.api}`;
                        SEARCH.fetch(url, storeName)
                    }
                }
            }
    },
    getDBResults: (storeName, keyValue) => {
        console.log('getDBResults running')
        let getFromStore = IDB.createTransaction(storeName).objectStore(storeName)
        if (typeof keyValue != 'number') keyValue = keyValue.toLowerCase()
        let getRequest = getFromStore.get(keyValue);
        getRequest.onsuccess = (ev) => {
                SEARCH.movieList = [...ev.target.result.results]
                if (storeName === 'searchStore') {
                    document.getElementById('searchQuery').textContent = ev.target.result.keyword
                } else {
                    document.getElementById('searchQuery').textContent = ev.target.result.name
                }
                MEDIA.buildCards(SEARCH.movieList)
            }
        }
}
const MEDIA = {
    buildCards: (data) => {
        if (document.querySelector('.display-area')) {document.querySelector('.display-area').innerHTML = ''
        if (data.length === 0) {
            document.querySelector('.display-area').innerHTML = 
            `
            <p class = "text-center mt-5">
            We couldn't find what you were looking for, please try a different keyword
            </p> 
            `
            return
        }
        let df = new DocumentFragment
        data.forEach(movie => {
            let li = document.createElement('li');
            let source =  `${APP.imageUrl}w500${movie.poster_path}`
            if (movie.poster_path === null) {
                source = './img/placeholder.png'
            }
            li.innerHTML = 
            `
            <div class="card h-100 m-2 mt-2  pe-none" id=${movie.id} style="width: 18rem;">
                <img class="card-img-top" src="${source}" alt="Card image cap">
                <div class="card-body d-flex flex-column">
                <h2 class="h5 card-title">${movie.original_title}</h2>
                <p class="card-text">IMDB Score: ${movie.vote_average.toFixed(1)}</p>
                <p class="card-text">Release date : ${movie.release_date}</p>
                <a class="btn btn-primary pe-auto mt-auto" id="get-similar">Similar movies</a>
                </div>
            </div>
            `
            df.append(li)
        })
        document.querySelector('.display-area').append(df)
        document.querySelectorAll('div.card').forEach (btn => {
            btn.addEventListener('click', SEARCH.handleSearch)
        })}
    }
}
APP.init();
