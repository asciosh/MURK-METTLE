use serde::Deserialize;
use url::Url;

#[derive(Deserialize)]
struct Deployment {
    origin: String,
}

#[derive(Clone, Debug)]
pub struct NavigationPolicy {
    game: Url,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Navigation {
    Game,
    ExternalHttps,
    Deny,
}

impl NavigationPolicy {
    pub fn from_json(json: &str) -> Result<Self, String> {
        let deployment: Deployment = serde_json::from_str(json).map_err(|e| e.to_string())?;
        Self::new(&deployment.origin)
    }
    pub fn new(origin: &str) -> Result<Self, String> {
        let game = Url::parse(origin).map_err(|e| e.to_string())?;
        if !safe_https(&game)
            || game.path() != "/"
            || game.query().is_some()
            || game.fragment().is_some()
        {
            return Err("Desktop deployment must be a root HTTPS origin without credentials, query or fragment".into());
        }
        Ok(Self { game })
    }
    pub fn game_url(&self) -> Url {
        self.game.clone()
    }
    pub fn classify(&self, url: &Url) -> Navigation {
        if !safe_https(url) {
            Navigation::Deny
        } else if url.origin() == self.game.origin() {
            Navigation::Game
        } else {
            Navigation::ExternalHttps
        }
    }
}

fn safe_https(url: &Url) -> bool {
    url.scheme() == "https"
        && url.host_str().is_some()
        && url.username().is_empty()
        && url.password().is_none()
}

pub fn launcher_navigation(url: &Url, development: bool) -> bool {
    if !url.username().is_empty() || url.password().is_some() {
        return false;
    }
    let bundled = (url.scheme() == "tauri" && url.host_str() == Some("localhost"))
        || (url.scheme() == "http"
            && url.host_str() == Some("tauri.localhost")
            && url.port().is_none());
    let dev = development
        && url.scheme() == "http"
        && url.host_str() == Some("127.0.0.1")
        && url.port() == Some(1420);
    (bundled || dev) && matches!(url.path(), "/" | "/index.html")
}

#[cfg(test)]
mod tests {
    use super::*;
    fn policy() -> NavigationPolicy {
        NavigationPolicy::from_json(include_str!("../../deployment.json")).unwrap()
    }
    #[test]
    fn deployment_is_a_root_secure_origin() {
        let p = policy();
        assert_eq!(p.game_url().scheme(), "https");
        assert_eq!(p.game_url().path(), "/");
        for bad in [
            "http://example.com",
            "file:///tmp/game",
            "https://user:pin@example.com",
            "https://example.com/game",
            "https://example.com/?token=x",
            "https://example.com/#x",
        ] {
            assert!(NavigationPolicy::new(bad).is_err(), "{bad}");
        }
    }
    #[test]
    fn only_exact_origin_remains_in_game_webview() {
        let p = policy();
        let origin = p.game_url().origin().ascii_serialization();
        for path in ["/", "/api/account/me", "/?room=FOREST", "/#journal"] {
            assert_eq!(
                p.classify(&Url::parse(&(origin.clone() + path)).unwrap()),
                Navigation::Game
            );
        }
        for candidate in [
            format!("{origin}.evil.test/"),
            format!("{origin}:444/"),
            "https://example.com/".into(),
        ] {
            assert_eq!(
                p.classify(&Url::parse(&candidate).unwrap()),
                Navigation::ExternalHttps
            );
        }
    }
    #[test]
    fn local_and_executable_schemes_and_url_credentials_are_denied() {
        for value in [
            "javascript:alert(1)",
            "file:///C:/Windows/system32/cmd.exe",
            "ms-settings:privacy",
            "data:text/html,hi",
            "blob:https://example.com/id",
            "http://example.com",
            "tauri://localhost/",
            "https://name:pin@example.com/",
            "https://name@example.com/",
            "about:blank",
        ] {
            assert_eq!(
                policy().classify(&Url::parse(value).unwrap()),
                Navigation::Deny,
                "{value}"
            );
        }
    }
    #[test]
    fn launcher_cannot_become_a_remote_privileged_window() {
        for value in ["tauri://localhost/index.html", "http://tauri.localhost/"] {
            assert!(launcher_navigation(&Url::parse(value).unwrap(), false));
        }
        assert!(launcher_navigation(
            &Url::parse("http://127.0.0.1:1420/").unwrap(),
            true
        ));
        assert!(!launcher_navigation(
            &Url::parse("http://127.0.0.1:1420/").unwrap(),
            false
        ));
        for value in [
            "https://example.com/",
            "http://tauri.localhost.evil.test/",
            "tauri://localhost/other.html",
            "http://localhost:1420/",
            "http://127.0.0.1:1421/",
            "file:///tmp/index.html",
        ] {
            assert!(
                !launcher_navigation(&Url::parse(value).unwrap(), true),
                "{value}"
            );
        }
    }
}
