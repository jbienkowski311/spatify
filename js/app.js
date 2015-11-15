var app = angular.module('app', ['ui.bootstrap', 'ui.router', 'spotify', 'ngCookies', 'ngAnimate']);

app.config(['$stateProvider', '$urlRouterProvider', '$compileProvider', 'SpotifyProvider', function($stateProvider, $urlRouterProvider, $compileProvider, SpotifyProvider){
	//ngCookies trick
	var $cookies;
	angular.injector(['ngCookies']).invoke(['$cookies', function(_$cookies_) {
		$cookies = _$cookies_;
	}]);

	$compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|chrome-extension|spotify):/);

	SpotifyProvider.setClientId('e31281fecafe435dae4d885c301de581');
	if(window.location.hostname == "localhost"){
		SpotifyProvider.setRedirectUri('http://localhost/spotify1/signin.html');
	}else{
		SpotifyProvider.setRedirectUri('http://jbienkowski311.github.io/spatify/signin.html');
	}
	SpotifyProvider.setScope('user-read-email user-read-private playlist-read-private playlist-modify-private playlist-modify-public user-library-read user-library-modify');
	if($cookies.get('spotify-token') != 'undefined'){
		SpotifyProvider.setAuthToken($cookies.get('spotify-token'));
	}else{
		SpotifyProvider.setAuthToken('');
	}

	$urlRouterProvider.otherwise('/start');

	$stateProvider
		.state('start', {
			url: '/start',
			views: {
				'' : {
					templateUrl: 'templates/start/main.html'
				},
				'welcome@start' : {
					templateUrl: 'templates/start/welcome.html'
				},
				'playlists@start' : {
					templateUrl: 'templates/start/playlists.html',
					controller: 'userPlaylistsCtrl'
				}
			}
		})
		.state('playlist', {
			url: '/playlist/{id}',
			templateUrl: 'templates/playlist/view.html',
			controller: 'playlistCtrl',
			data: {
				searchData: {
					empty: true
				}
			}
		})
		.state('artist', {
			url: '/artist/{artistId}',
			templateUrl: 'templates/artist/view.html',
			controller: 'artistCtrl'
		})
		.state('album', {
			url: '/album/{albumId}',
			templateUrl: 'templates/album/view.html',
			controller: 'albumCtrl'
		})
		.state('track', {
			url: '/track/{trackId}',
			templateUrl: 'templates/track/view.html',
			controller: 'trackCtrl'
		})
		.state('search', {
			url: '/search?{query}&{filter}',
			templateUrl: 'templates/search.html',
			controller: 'searchResultCtrl',
			data: {
				returnData: {}
			}
		})
		.state('about', {
			url: '/about',
			templateUrl: 'templates/about.html'
		})
		.state('signin', {
			url: '/signin',
			templateUrl: 'templates/signin.html',
			controller: 'signInCtrl'
		})
		.state('userinfo', {
			url: '/user/info',
			templateUrl: 'templates/user/user.html'
		})
		.state('savedtracks', {
			url: '/user/savedtracks',
			templateUrl: 'templates/user/savedtracks.html',
			controller: 'savedTracksCtrl'
		});
}]);

//controllers

app.controller('signInCtrl', ['$scope', '$state', '$cookies', 'Spotify', function($scope, $state, $cookies, Spotify){
	$scope.signin = function(){
		Spotify.login().then(function(data){
			if(localStorage.getItem('spotify-token') != 'undefined'){
				console.log('logowanie udane');
				var date = new Date();
				date.setTime(date.getTime() + 3600000);
				$cookies.put('spotify-token', localStorage.getItem('spotify-token'), { expires: date });
				localStorage.removeItem('spotify-token');
				window.location.href = "index.html";
			}else{
				console.log('logowanie nieudane');
			}
		});
	};
}]);

app.controller('isUserLoggedCtrl', ['$scope', '$state', '$cookies', 'Spotify', 'userService', 'playlistService', function($scope, $state, $cookies, Spotify, userService, playlistService){
	$scope.isLogged = false;

	if(!userService.isUserLogged() && $cookies.get('spotify-token') != 'undefined'){
		Spotify.getCurrentUser().then(function(data){
			userService.createUser(data);
			$scope.isLogged = userService.isUserLogged();
			$scope.userData = userService.getUser();
			Spotify.getUserPlaylists(userService.getUser().id, {offset: 0, limit: 20}).then(function(data){
				playlistService.setPlaylists(data);
			});
		});
	}

	$scope.signout = function(){
		if(userService.isUserLogged()){
			$cookies.remove('spotify-token');
			userService.userSignOut();
			$scope.isLogged = userService.isUserLogged();
			$state.go('start');
		}
	};
}]);

app.controller('searchCtrl', ['$scope', '$state', function($scope, $state){
	angular.element('.search-panel .dropdown-menu').find('a').on('click', function(e){
		e.preventDefault();
		var param = $(this).data("filter");
		var concept = $(this).text();
		angular.element('.search-panel span#search_concept').text(concept);
		angular.element('.input-group #search_param').val(param);
	});

	$scope.searchForm = function(){
		var filterVal = angular.element('.input-group #search_param').val();
		angular.element('.form-control').val('');
		$state.go('search', {query: $scope.query, filter: filterVal});
	};
}]);

app.controller('searchResultCtrl', ['$scope', '$sce', '$state', '$stateParams', 'Spotify', 'trackPreviewService', function($scope, $sce, $state, $stateParams, Spotify, trackPreviewService){
	$scope.tabs = {albums: {disabled: true, total: 0}, artists: {disabled: true, total: 0}, tracks: {disabled: true, total: 0}, playlists: {disabled: true, total: 0}};
	if($stateParams.filter === 'artist' || $stateParams.filter === 'album' || $stateParams.filter === 'track' || $stateParams.filter === 'playlist'){
		Spotify.search($stateParams.query.replace(' ', '+'), $stateParams.filter, {offset: 0, limit: 50}).then(function(data){
			$scope.returnData = data;
			console.log(data);
			$scope.tabs[$stateParams.filter+'s'].disabled = false;
			$scope.tabs[$stateParams.filter+'s'].active = true;
			$scope.tabs[$stateParams.filter+'s'].total = $scope.returnData[$stateParams.filter+'s'].total;
			if($stateParams.filter === 'playlist'){
				$state.get('playlist').data.searchData = $scope.returnData['playlists'];
				$state.get('playlist').data.searchData.empty = false;
			}
		});
	}else if($stateParams.filter === 'all'){
		Spotify.search($stateParams.query.replace(' ', '+'), 'artist,album,track,playlist', {offset: 0, limit: 50}).then(function(data){
			$scope.returnData = data;
			console.log(data);
			$scope.tabs = {albums: {disabled: false, total: $scope.returnData['albums'].total}, artists: {active: true, disabled: false, total: $scope.returnData['artists'].total}, tracks: {disabled: false, total: $scope.returnData['tracks'].total}, playlists: {disabled: false, total: $scope.returnData['playlists'].total}};
			$state.get('playlist').data.searchData = $scope.returnData['playlists'];
			$state.get('playlist').data.searchData.empty = false;
		});
	}

	if($stateParams.filter === 'track' || $stateParams.filter === 'all'){
		$scope.playPreview = function(index){
			trackPreviewService.playPreview(index);
		};

		$scope.volumeControl = function(index,sw){
			trackPreviewService.volumeControl(index,sw);
		};

		$scope.getPreviewUrl = function(url){
			return trackPreviewService.getPreviewUrl(url);
		};
	}
}]);

app.controller('userPlaylistsCtrl', ['$scope', 'Spotify', 'userService', 'playlistService', function($scope, Spotify, userService, playlistService){
	angular.element('#loading').css('display', 'none');
	$scope.userPlaylists = playlistService.getPlaylists();
	if($scope.userPlaylists === null){
		angular.element('#loading').css('display', 'inline');
		Spotify.getUserPlaylists(userService.getUser().id, {offset: 0, limit: 50}).then(function(data){
			playlistService.setPlaylists(data);
			$scope.userPlaylists = data;
			console.log(data);
			angular.element('#loading').css('display', 'none');
		});
	}
}]);

app.controller('playlistCtrl', ['$scope', '$sce', '$state', '$cookies', '$stateParams', 'Spotify', 'playlistService', 'tracksService', 'trackPreviewService', function($scope, $sce, $state, $cookies, $stateParams, Spotify, playlistService, tracksService, trackPreviewService){
	var playlists = playlistService.getPlaylists();

	$scope.ready = false;
	$scope.currentPage = 1;

	if(playlists === null && $state.current.data.searchData.empty){
		$state.go('start');
	}else{
		if(!$state.current.data.searchData.empty){
			$scope.playlist = $state.current.data.searchData.items[$stateParams.id];
			$state.current.data.searchData.empty = true;
		}else{
			$scope.playlist = playlists.items[$stateParams.id];
		}
		var iter = $scope.playlist.tracks.total/100+1;
		iter = parseInt(iter, 10);

		$scope.iter = iter;

		Spotify.getUser($scope.playlist.owner.id).then(function(data){
			$scope.owner = data;
			console.log(data);
		});

		$scope.playlistTracks = [];

		tracksService.getTracks($scope.playlist.owner.id, $scope.playlist.id, iter, $cookies.get('spotify-token')).then(function(data){
			$scope.playlistTracks = data;
			console.log($scope.playlistTracks);
			$scope.filteredTracks = $scope.playlistTracks[$scope.currentPage - 1].data;
			console.log($scope.filteredTracks);
			$scope.ready = true;
			angular.element('#loading').css('display', 'none');
		});

		console.log($scope.playlist);
	}

	$scope.playPreview = function(index){
		trackPreviewService.playPreview(index);
	};

	$scope.volumeControl = function(index,sw){
		trackPreviewService.volumeControl(index,sw);
	};

	$scope.getPreviewUrl = function(url){
		return trackPreviewService.getPreviewUrl(url);
	};

	$scope.$watch("currentPage", function(){
		if($scope.ready){
				$scope.filteredTracks = $scope.playlistTracks[$scope.currentPage - 1].data;
		}
	});
}]);

app.controller('artistCtrl', ['$scope', '$sce', '$state', '$stateParams', '$uibModal', 'Spotify', 'trackPreviewService', function($scope, $sce, $state, $stateParams, $uibModal, Spotify, trackPreviewService){
	if($stateParams.artistId === ""){
		$state.go('start');
	}

	Spotify.getArtist($stateParams.artistId).then(function(data){
		$scope.artist = data;
		console.log(data);
	});

	Spotify.getCurrentUser().then(function(data){
		Spotify.getRelatedArtists($stateParams.artistId).then(function(data){
			$scope.relatedArtists = data;
			console.log(data);
			$scope.open = function(){
				var modalInstance = $uibModal.open({
					animation: true,
					templateUrl: 'relatedArtistsModal.html',
					size: 'lg',
					controller: 'relatedModalCtrl',
					resolve: {
						relatedArtists: function(){
							return data;
						}
					}
				});
			};
		});
		Spotify.getArtistTopTracks($stateParams.artistId, data.country).then(function(data){
			$scope.topTracks = data;
			var topTracksAlbums = [];
			for(i=0; i<data.tracks.length; i++){
				topTracksAlbums.push(data.tracks[i].album.id);
			}
			Spotify.getAlbums(topTracksAlbums).then(function(data){
				$scope.topTracksAlbumsInfo = [];
				for(i=0; i<data.albums.length; i++){
					if(data.albums[i].images.length > 0){
						var html = '<img src="' + data.albums[i].images[0].url + '" class="img-thumbnail" />';
					}else{
						var html = '<img src="http://placehold.it/300x300" class="img-thumbnail" />';
					}
					html = $sce.trustAsHtml(html);
					$scope.topTracksAlbumsInfo.push(html);
				}
				console.log(data);
			});
			console.log(data);
		});
		Spotify.getArtistAlbums($stateParams.artistId, { album_type: 'album,single', country: data.country, limit: 12 }).then(function(data){
			$scope.albums = data;
			console.log(data);
		});
	});

	$scope.playPreview = function(index){
		trackPreviewService.playPreview(index);
	};

	$scope.volumeControl = function(index,sw){
		trackPreviewService.volumeControl(index,sw);
	};

	$scope.getPreviewUrl = function(url){
		return trackPreviewService.getPreviewUrl(url);
	};
}]);

app.controller('albumCtrl', ['$scope', '$state', '$stateParams', 'Spotify', 'trackPreviewService', function($scope, $state, $stateParams, Spotify, trackPreviewService){
	if($stateParams.albumId === ""){
		$state.go('start');
	}

	Spotify.getAlbum($stateParams.albumId).then(function(data){
		$scope.album = data;
		console.log(data);
	});

	$scope.getDuration = function(ms){
		var sec = parseInt(ms/1000, 10);
		var min = parseInt(sec/60, 10);
		sec = sec%60;
		sec = sec < 10 ? '0' + sec : sec;
		return min + ':' + sec;
	};

	$scope.playPreview = function(index){
		trackPreviewService.playPreview(index);
	};

	$scope.volumeControl = function(index,sw){
		trackPreviewService.volumeControl(index,sw);
	};

	$scope.getPreviewUrl = function(url){
		return trackPreviewService.getPreviewUrl(url);
	};
}]);

app.controller('trackCtrl', ['$scope', '$state', '$stateParams', 'Spotify', 'trackPreviewService', function($scope, $state, $stateParams, Spotify, trackPreviewService){
	if($stateParams.trackId === ""){
		$state.go('start');
	}

	Spotify.getTrack($stateParams.trackId).then(function(data){
		$scope.track = data;
		console.log(data);
		Spotify.getAlbum(data.album.id).then(function(data){
			$scope.album = data;
			console.log(data);
			var src = data.images.length > 0 ? data.images[0].url : 'http://placehold.it/300x300';
		});
	});

	$scope.getDuration = function(ms){
		var sec = parseInt(ms/1000, 10);
		var min = parseInt(sec/60, 10);
		sec = sec%60;
		sec = sec < 10 ? '0' + sec : sec;
		return min + ':' + sec;
	};

	$scope.playPreview = function(index){
		trackPreviewService.playPreview(index);
	};

	$scope.volumeControl = function(index,sw){
		trackPreviewService.volumeControl(index,sw);
	};

	$scope.getPreviewUrl = function(url){
		return trackPreviewService.getPreviewUrl(url);
	};
}]);

app.controller('savedTracksCtrl', ['$scope', 'Spotify', 'trackPreviewService', function($scope, Spotify, trackPreviewService){
	Spotify.getCurrentUser().then(function(data){
		$scope.userData = data;
		console.log(data);
	});
	angular.element('#loading').css('display', 'none');
	Spotify.getSavedUserTracks({limit: 50}).then(function(data){
		angular.element('#loading').css('display', 'inline');
		$scope.savedTracks = data;
		console.log(data);
		angular.element('#loading').css('display', 'none');
		$scope.playPreview = function(index){
			trackPreviewService.playPreview(index);
		};

		$scope.volumeControl = function(index,sw){
			trackPreviewService.volumeControl(index,sw);
		};

		$scope.getPreviewUrl = function(url){
			return trackPreviewService.getPreviewUrl(url);
		};
	});
}]);

app.controller('relatedModalCtrl', ['$scope', '$uibModalInstance', 'relatedArtists', function($scope, $uibModalInstance, relatedArtists){
	$scope.relatedArtists = relatedArtists;

	$scope.ok = function () {
		$uibModalInstance.close();
	};
}]);

//services

app.service('userService', function(){
	
	this.user = null;

	this.createUser = function(newUser){
		this.user = newUser;
	};

	this.getUser = function(){
		return this.user;
	};

	this.isUserLogged = function(){
		return !(this.user === null);
	};

	this.userSignOut = function(){
		this.user = null;
	};
});

app.service('playlistService', function(){

	this.playlists = null;

	this.setPlaylists = function(obj){
		this.playlists = obj;
	};

	this.getPlaylists = function(){
		return this.playlists;
	};
});

app.service('trackPreviewService', ['$sce', function($sce){
	this.isPlaying = false;

	this.playPreview = function(index){
		var track = document.getElementById('track-'+index);
		var controls = angular.element(document.getElementById('controls-'+index));
		if(!this.isPlaying){
			track.volume = 0.5;
			track.play();
			controls.removeClass('fa-play').addClass('fa-pause');
			this.isPlaying = !this.isPlaying;
			angular.element(track).bind('ended', function(){
				controls.removeClass('fa-pause').addClass('fa-play');
				this.isPlaying = !this.isPlaying;
			});
		}else{
			track.pause();
			controls.removeClass('fa-pause').addClass('fa-play');
			this.isPlaying = !this.isPlaying;
		}
	};

	this.volumeControl = function(index, sw){
		//sw=0 0.1 down
		//sw=1 0.1 up
		if(sw){
			if(document.getElementById('track-'+index).volume < 1){
				document.getElementById('track-'+index).volume += 0.1;
			}
		}else{
			if(document.getElementById('track-'+index).volume > 0){
				document.getElementById('track-'+index).volume -= 0.1;
			}
		}
	};

	this.getPreviewUrl = function(url){
		if(url === ""){
			return null;
		}else{
			return $sce.trustAsResourceUrl(url);
		}
	};
}]);

//factories

app.factory('tracksService', ['$http', '$q', function($http, $q){
	return {
		getTracks(userId, playlistId, length, token){
			var promises = [];

			for(i=0; i<length; i++){
				promises.push($http({
					url: 'https://api.spotify.com/v1/users/'+userId+'/playlists/'+playlistId+'/tracks',
					method: 'GET',
					headers: {'Authorization': 'Bearer '+token, 'Content-Type': 'application/json'},
					params: {offset: i*100, limit: 100}
				}));
			}

			return $q.all(promises);
		}
	};
}]);