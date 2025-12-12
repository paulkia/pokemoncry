import { Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

import BuyCoffeeButton from "./BuyCoffeeButton";
import { ROUTER_UTIL } from "../library/util";

function AppFooter() {
  const navigate = useNavigate();

  return (
    <footer className="App mt-5">
      <span className="text-muted">v1.0 • </span>
      <BuyCoffeeButton /> •{" "}
      <Button
        variant="link"
        onClick={() => {
          navigate(ROUTER_UTIL.PRIVACY_POLICY);
        }}
      >
        Privacy Policy
      </Button>
    </footer>
  );
}

export default AppFooter;
