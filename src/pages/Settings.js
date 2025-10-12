import "../App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import React, { useState, useReducer, useEffect } from "react";
import { useLocation } from "react-router-dom";
import Pokedex from "pokedex-promise-v2";
import {
  FormControl,
  Modal,
  OverlayTrigger,
  Tooltip,
  ProgressBar,
  Button,
  Form,
  InputGroup,
} from "react-bootstrap";
import { Trie } from "../library/trie";
import { shuffle } from "../library/util";

function Settings({ settings, setSettings }) {
  console.log("settings.show: ", settings);
  return (
    <span>
      <div
        style={{
          position: "absolute",
          top: -100,
          right: -200,
          zIndex: 2, // ensure it appears above everything else
          cursor: "pointer",
        }}
        onClick={() => setSettings({ ...settings, show: true })}
      >
        <i className="bi bi-gear-fill" style={{ fontSize: "24px" }}></i>
      </div>
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
                  Modern cries only{" "}
                  <OverlayTrigger
                    placement="right"
                    overlay={
                      <Tooltip id="tooltip-legacy">
                        If disabled, plays older-style Pokémon cries instead of
                        modern versions for early-gen Pokémon such as Pikachu.
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
              checked={settings.useLatestCries}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  useLatestCries: !settings.useLatestCries,
                })
              }
            />
            <Form.Check
              type="checkbox"
              id="fast-mode"
              label={
                <>
                  Fast Mode{" "}
                  <OverlayTrigger
                    placement="right"
                    overlay={
                      <Tooltip id="tooltip-legacy">
                        Shortens time delays and accelerates transitions.
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
              checked={settings.fastMode}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  fastMode: !settings.fastMode,
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
