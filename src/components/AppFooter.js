import { Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

import BuyCoffeeButton from "./BuyCoffeeButton";
import { ROUTER_UTIL } from "../library/util";

function AppFooter({ disableBuyMeACoffee = false }) {
  const navigate = useNavigate();

  return (
    <footer className="App mt-5">
      <span className="text-muted m-1">v0.2 • </span>
      {disableBuyMeACoffee ? null : (
        <span>
          <BuyCoffeeButton className="m-1" /> •{" "}
        </span>
      )}
      <Button
        className="m-1"
        variant="outline-secondary"
        onClick={() => navigate(ROUTER_UTIL.PRIVACY_POLICY)}
      >
        Privacy Policy
      </Button>
    </footer>
  );
}

export default AppFooter;
