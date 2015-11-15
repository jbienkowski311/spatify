var app = angular.module('app', ['ui.bootstrap', 'ui.router', 'spotify', 'ngCookies', 'ngAnimate']);

app.config(['$stateProvider', '$urlRouterProvider', '$compileProvider', 'SpotifyProvider', function($stateProvider, $urlRouterProvider, $compileProvider, SpotifyProvider){
	//ngCookies trick
	var $cookies;
	angular.injector(['ngCookies']).invoke(['$cookies', function(_$cookies_) {
		$cookies = _$cookies_;
	}]);

	$compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|chrome-extension|spotify):/);

	SpotifyProvider.setClientId('e31281fecafe435dae4d885c301de581');
	SpotifyProvider.setRedirectUri('http://jbienkowski311.github.io/spatify/signin.html');
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

app.controller('searchResultCtrl', ['$scope', '$state', '$stateParams', 'Spotify', function($scope, $state, $stateParams, Spotify){
	$scope.tabs = {albums: {disabled: true, total: 0}, artists: {disabled: true, total: 0}, tracks: {disabled: true, total: 0}, playlists: {disabled: true, total: 0}};
	if($stateParams.filter === 'artist' || $stateParams.filter === 'album' || $stateParams.filter === 'track' || $stateParams.filter === 'playlist'){
		Spotify.search($stateParams.query.replace(' ', '+'), $stateParams.filter, {offset: 0, limit: 50}).then(function(data){
			$state.current.data.returnData = data;
			console.log(data);
			$scope.returnData = $state.current.data.returnData;
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
			$state.current.data.returnData = data;
			console.log(data);
			$scope.returnData = $state.current.data.returnData;
			$scope.tabs = {albums: {disabled: false, total: $scope.returnData['albums'].total}, artists: {active: true, disabled: false, total: $scope.returnData['artists'].total}, tracks: {disabled: false, total: $scope.returnData['tracks'].total}, playlists: {disabled: false, total: $scope.returnData['playlists'].total}};
			$state.get('playlist').data.searchData = $scope.returnData['playlists'];
			$state.get('playlist').data.searchData.empty = false;
		});
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

app.controller('playlistCtrl', ['$scope', '$state', '$sce', '$cookies', '$stateParams', 'Spotify', 'playlistService', 'tracksService', function($scope, $state, $sce, $cookies, $stateParams, Spotify, playlistService, tracksService){
	var playlists = playlistService.getPlaylists();

	$scope.isPlaying = false;
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
		var track = document.getElementById('track-'+index);
		var controls = angular.element(document.getElementById('controls-'+index));
		if(!$scope.isPlaying){
			track.volume = 0.5;
			track.play();
			controls.removeClass('fa-play').addClass('fa-pause');
			$scope.isPlaying = true;
			angular.element(track).bind('ended', function(){
				controls.removeClass('fa-pause').addClass('fa-play');
				$scope.isPlaying = false;
			});
		}else{
			track.pause();
			controls.removeClass('fa-pause').addClass('fa-play');
			$scope.isPlaying = false;
		}
	};

	$scope.volumeControl = function(index, sw){
		//sw=0 0.1 down
		//sw=1 0.1 up
		if(sw){
			document.getElementById('track-'+index).volume += 0.1;
		}else{
			document.getElementById('track-'+index).volume -= 0.1;
		}
	};

	$scope.getPreviewUrl = function(index){
		return $sce.trustAsResourceUrl($scope.filteredTracks.items[index].track.preview_url);
	};

	$scope.$watch("currentPage", function(){
		if($scope.ready){
				$scope.filteredTracks = $scope.playlistTracks[$scope.currentPage - 1].data;
		}
	});
}]);

app.controller('artistCtrl', ['$scope', '$state', '$stateParams', '$uibModal', 'Spotify', function($scope, $state, $stateParams, $uibModal, Spotify){
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
			console.log(data);
		});
		Spotify.getArtistAlbums($stateParams.artistId).then(function(data){
			$scope.albums = data;
			console.log(data);
		});
	});
}]);

app.controller('savedTracksCtrl', ['$scope', 'Spotify', function($scope, Spotify){
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

//factories

app.factory('tracksService', function($http, $q){
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
});
