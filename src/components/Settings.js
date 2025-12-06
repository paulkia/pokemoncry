import "../App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { useSettings } from "../AppContext";
import { Modal, OverlayTrigger, Tooltip, Button, Form } from "react-bootstrap";
import { LOCAL_STORAGE_UTIL, ROUTER_UTIL } from "../library/util";
import { useLocation } from "react-router-dom";

function updateSettings(newSettings, setSettings) {
  setSettings(newSettings);
  localStorage.setItem(
    LOCAL_STORAGE_UTIL.SETTINGS,
    JSON.stringify(newSettings)
  );
}

function Settings() {
  const location = useLocation();
  const { settings, setSettings } = useSettings();
  return (
    <span>
      <Button
        variant="light"
        onClick={() => updateSettings({ ...settings, show: true }, setSettings)}
      >
        <i className="bi bi-gear-fill" style={{ fontSize: "24px" }}></i>
      </Button>
      <Modal
        show={settings.show || false}
        onHide={() => updateSettings({ ...settings, show: false }, setSettings)}
        centered
        className="App"
      >
        <Modal.Header closeButton>
          <Modal.Title>Settings</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            {location.pathname === ROUTER_UTIL.CHALLENGE ? null : (
              <Form.Check
                type="checkbox"
                id="legacy-cries"
                label={
                  <>
                    Prefer legacy cries{" "}
                    <OverlayTrigger
                      placement="right"
                      overlay={
                        <Tooltip id="tooltip-legacy">
                          If enabled, plays original Pokemon game cries for
                          early-gen Pokemon such as Lugia.
                        </Tooltip>
                      }
                    >
                      <i
                        className="bi bi-info-circle"
                        style={{ cursor: "pointer", marginLeft: "4px" }}
                      ></i>
                    </OverlayTrigger>
                  </>
                }
                checked={settings.preferLegacyCries}
                onChange={(e) =>
                  updateSettings(
                    {
                      ...settings,
                      preferLegacyCries: !settings.preferLegacyCries,
                    },
                    setSettings
                  )
                }
              />
            )}
            <Form.Check
              type="checkbox"
              id="disable-animations"
              label={
                <>
                  Disable animations{" "}
                  <OverlayTrigger
                    placement="right"
                    overlay={
                      <Tooltip id="tooltip-legacy">
                        If enabled, uses static sprites instead of gifs.
                        Automatically kicks in if many Pokemon are on-screen.
                      </Tooltip>
                    }
                  >
                    <i
                      className="bi bi-info-circle"
                      style={{ cursor: "pointer", marginLeft: "4px" }}
                    ></i>
                  </OverlayTrigger>
                </>
              }
              checked={settings.disableAnimations}
              onChange={(e) =>
                updateSettings(
                  {
                    ...settings,
                    disableAnimations: !settings.disableAnimations,
                  },
                  setSettings
                )
              }
            />
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() =>
              updateSettings({ ...settings, show: false }, setSettings)
            }
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </span>
  );
}

export default Settings;
