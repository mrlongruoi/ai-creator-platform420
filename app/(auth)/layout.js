import PropTypes from "prop-types";

const AuthLayout = ({ children }) => {
  return <div className="flex justify-center pt-48">{children}</div>;
};

AuthLayout.propTypes = {
  children: PropTypes.node,
};

export default AuthLayout;
