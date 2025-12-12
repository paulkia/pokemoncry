import { Button } from "react-bootstrap";

function BuyCoffeeButton() {
  return (
    <Button
      variant="outline-info"
      href="https://www.buymeacoffee.com/zechla"
      target="_blank"
      rel="noreferrer"
      onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
      onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      ☕️ Buy me a coffee
    </Button>
  );
}

export default BuyCoffeeButton;
