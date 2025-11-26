import "../App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { Modal, OverlayTrigger, Tooltip, Button, Form } from "react-bootstrap";

function Settings({ settings, setSettings }) {
  return (
    <span>
      <Button
        variant="light"
        onClick={() => setSettings({ ...settings, show: true })}
      >
        <i className="bi bi-gear-fill" style={{ fontSize: "24px" }}></i>
      </Button>
      <Modal
        show={settings.show || false}
        onHide={() => setSettings({ ...settings, show: false })}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Settings</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
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
                        early-gen Pokemon such as Pikachu.
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
                setSettings({
                  ...settings,
                  preferLegacyCries: !settings.preferLegacyCries,
                })
              }
            />
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
                setSettings({
                  ...settings,
                  disableAnimations: !settings.disableAnimations,
                })
              }
            />
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setSettings({ ...settings, show: false })}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </span>
  );
}

export default Settings;
