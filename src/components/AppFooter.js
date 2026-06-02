import { Button } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";

// import BuyCoffeeButton from "./BuyCoffeeButton";
import { ROUTER_UTIL } from "../library/util";

function AppFooter({ disableBuyMeACoffee = false }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <footer className="App mt-5">
      <span className="text-muted m-1">v0.2</span>
      {/* {!disableBuyMeACoffee && (
        <>
          {" • "}
          <BuyCoffeeButton className="m-1" />
        </>
      )} */}
      {location.pathname !== ROUTER_UTIL.PRIVACY_POLICY && (
        <>
          {" • "}
          <Button
            className="m-1"
            variant="outline-secondary"
            onClick={() => navigate(ROUTER_UTIL.PRIVACY_POLICY)}
          >
            <i class="bi bi-heart-fill" /> Privacy Policy
          </Button>
        </>
      )}
      {location.pathname !== ROUTER_UTIL.TOS && (
        <>
          {" • "}
          <Button
            className="m-1"
            variant="outline-secondary"
            onClick={() => navigate(ROUTER_UTIL.TOS)}
          >
            <i class="bi bi-book-half" /> Terms of Service
          </Button>
        </>
      )}
      {" • "}
      <Button
        variant="outline-warning"
        href="https://forms.gle/qmr1XUVMJFc2JDfo7"
        target="_blank"
      >
        <i class="bi bi-bug-fill" /> File Bug
      </Button>
    </footer>
  );
}

export default AppFooter;
